#!/usr/bin/env bash
# version: 2
# ─────────────────────────────────────────────────────────────────────────────
# recibir-despliegue-front.sh — the only command the front CI's SSH key can run on the VPS (deploy/README.md).
#
# Installed as /usr/local/sbin/halsa-recibir-despliegue-front (root 0755), OUTSIDE any folder the deploy writes:
# the code the CI's key reaches only changes when a person reinstalls it. Same model as the backend's
# recibir-despliegue.sh: the images travel inside the SSH session, there is no registry.
#
#   ssh halsa-deploy@vps "desplegar v1.0.<n>" < paquete.tar
#
#   paquete.tar   manifiesto.sha256 and imagenes.tar.gz (halsa-backoffice and halsa-portal, linux/arm64)
#
#   1. validates SSH_ORIGINAL_COMMAND and the tag; takes the lock (one deploy at a time)
#   2. copies stdin to <entregas>/<tag>/ (up to HALSA_FRONT_PAQUETE_MAX_MB) and checks sha256sum -c
#   3. podman load; checks that both images of the tag are there
#   4. writes HALSA_FRONT_TAG in ~/.config/halsa-frontend/frontend.env and restarts halsa-backoffice and halsa-portal
#      (the units use Notify=healthy: systemctl restart only returns once /health answers)
#   5. if the restart fails, goes back to the previous tag
#   6. keeps the last HALSA_FRONT_VERSIONES_RETENIDAS tags (the current and the previous one always stay)
#
# By hand, as the Quadlets' owner (no SSH_ORIGINAL_COMMAND), to go back to a tag that is still loaded:
#   halsa-recibir-despliegue-front revertir v1.0.41
#
# Runs as the owner of the rootless Quadlets (sudo -u, runbook §4.4). Exit: 2 invalid command; 1 any failure
# (in steps 1-3 nothing has changed yet).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HOME="$(getent passwd "$(id -un)" | cut -d: -f6)"
XDG_RUNTIME_DIR="/run/user/$(id -u)"
export HOME XDG_RUNTIME_DIR

ENV_FILE="$HOME/.config/halsa-frontend/frontend.env"
ENTREGAS="$HOME/.local/state/halsa/entregas-front"
LOCK="$XDG_RUNTIME_DIR/halsa-front-despliegue.lock"
MAX_MB="${HALSA_FRONT_PAQUETE_MAX_MB:-1024}"
RETENIDAS="${HALSA_FRONT_VERSIONES_RETENIDAS:-5}"
REGEX_TAG='^v[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$'
IMAGENES=(halsa-backoffice halsa-portal)
UNIDADES=(halsa-backoffice.service halsa-portal.service)

info() { echo "==> $(date -u +%H:%M:%S) $*" >&2; }
fallo() { echo "FALLO: $*" >&2; exit 1; }

# ── 1. Comando, tag y lock ───────────────────────────────────────────────────
if [[ -n "${SSH_ORIGINAL_COMMAND:-}" ]]; then
    read -r accion tag resto <<< "$SSH_ORIGINAL_COMMAND" || true
    permitida="desplegar"
else
    accion="${1:-}"
    tag="${2:-}"
    resto=""
    permitida="revertir"
fi
if [[ "${accion:-}" != "$permitida" || -n "${resto:-}" || ! "${tag:-}" =~ $REGEX_TAG ]]; then
    # An ssh without a command (no args, no SSH_ORIGINAL_COMMAND) is a remote caller: tell it the remote command.
    if [[ -z "${SSH_ORIGINAL_COMMAND:-}" && $# -eq 0 ]]; then permitida="desplegar"; fi
    echo "comando no permitido; el único válido es: $permitida <tag vX.Y.Z>" >&2
    exit 2
fi
[[ "$MAX_MB" =~ ^[0-9]+$ && "$RETENIDAS" =~ ^[0-9]+$ ]] || fallo "HALSA_FRONT_PAQUETE_MAX_MB y HALSA_FRONT_VERSIONES_RETENIDAS deben ser enteros"
[[ -f "$ENV_FILE" ]] || fallo "falta $ENV_FILE (runbook §4.4)"
for u in "${UNIDADES[@]}"; do
    [[ -f "$HOME/.config/containers/systemd/${u%.service}.container" ]] \
        || fallo "falta el Quadlet ${u%.service}.container en ~/.config/containers/systemd (runbook §4.4)"
done

exec 9>"$LOCK"
info "esperando el lock de despliegue"
flock -w 1800 9 || fallo "otro despliegue tiene el lock desde hace 30 min"

fijar_tag() {
    if grep -q '^HALSA_FRONT_TAG=' "$ENV_FILE"; then
        sed -i "s/^HALSA_FRONT_TAG=.*/HALSA_FRONT_TAG=$1/" "$ENV_FILE"
    else
        echo "HALSA_FRONT_TAG=$1" >> "$ENV_FILE"
    fi
}
reiniciar() { systemctl --user restart "${UNIDADES[@]}"; }
anterior="$(grep -E '^HALSA_FRONT_TAG=' "$ENV_FILE" | cut -d= -f2- || true)"

verificar_imagenes() {
    local i
    for i in "${IMAGENES[@]}"; do
        podman image inspect "localhost/$i:$1" >/dev/null 2>&1 || return 1
    done
}

if [[ "$accion" == "desplegar" ]]; then
    entrega="$ENTREGAS/$tag"
    limpiar() { rm -rf "$entrega"; }
    trap limpiar EXIT
    rm -rf "$entrega"
    mkdir -p "$ENTREGAS"
    chmod 0700 "$ENTREGAS"
    mkdir -m 0700 "$entrega"

    # ── 2. Recepción y sumas ─────────────────────────────────────────────────
    info "1/4 recibiendo el paquete de $tag (máximo ${MAX_MB} MB)"
    head -c "$((MAX_MB * 1024 * 1024))" > "$entrega/paquete.tar"
    if [[ "$(head -c 1 | wc -c)" -gt 0 ]]; then
        fallo "el paquete supera ${MAX_MB} MB; nada cambió"
    fi
    miembros="$(tar -tf "$entrega/paquete.tar")" || fallo "el paquete no es un tar válido; nada cambió"
    while IFS= read -r m; do
        case "$m" in
            manifiesto.sha256|imagenes.tar.gz) ;;
            *) fallo "miembro inesperado en el paquete: '$m'; nada cambió" ;;
        esac
    done <<< "$miembros"
    tar -xf "$entrega/paquete.tar" -C "$entrega" --no-same-owner
    rm -f "$entrega/paquete.tar"
    for requerido in manifiesto.sha256 imagenes.tar.gz; do
        [[ -f "$entrega/$requerido" ]] || fallo "falta $requerido en el paquete; nada cambió"
    done
    grep -Eq '^[0-9a-f]{64}  imagenes.tar.gz$' "$entrega/manifiesto.sha256" \
        || fallo "imagenes.tar.gz no está en el manifiesto; nada cambió"
    (cd "$entrega" && sha256sum --quiet -c manifiesto.sha256) || fallo "las sumas sha256 no coinciden; nada cambió"

    # ── 3. Imágenes ──────────────────────────────────────────────────────────
    info "2/4 podman load"
    gunzip -c "$entrega/imagenes.tar.gz" | podman load >&2 || fallo "podman load; nada cambió"
fi

verificar_imagenes "$tag" || fallo "faltan las imágenes localhost/halsa-{backoffice,portal}:$tag; nada cambió"

# ── 4. Reinicio ──────────────────────────────────────────────────────────────
info "3/4 $tag (antes: ${anterior:-ninguna})"
fijar_tag "$tag"
if ! reiniciar; then
    echo "FALLO: las unidades no quedaron sanas con $tag." >&2
    # The CI log is the only place the person looking at a red deploy can read this.
    for c in halsa-backoffice halsa-portal; do
        echo "--- $c: estado y últimas líneas del log" >&2
        podman ps -a --filter "name=^$c\$" --format '{{.Names}} {{.Status}}' >&2 || true
        podman logs --tail 25 "$c" >&2 2>&1 || true
    done
    if [[ -n "$anterior" && "$anterior" != "$tag" ]] && verificar_imagenes "$anterior"; then
        info "volviendo a $anterior"
        fijar_tag "$anterior"
        reiniciar || echo "FALLO: tampoco $anterior arrancó; revisa journalctl --user -u halsa-backoffice -u halsa-portal" >&2
    fi
    exit 1
fi
podman ps --filter name=halsa-backoffice --filter name=halsa-portal --format '{{.Names}} {{.Image}} {{.Status}}' >&2

# ── 5. Retención ─────────────────────────────────────────────────────────────
info "4/4 retención: ${RETENIDAS} versiones, más $tag y ${anterior:-ninguna}"
declare -A conservar=(["$tag"]=1)
[[ -n "$anterior" ]] && conservar["$anterior"]=1
mapfile -t tags < <(podman image ls localhost/halsa-backoffice --format '{{.CreatedAt}}|{{.Tag}}' | sort -r | cut -d'|' -f2)
for t in "${tags[@]}"; do
    [[ "$t" == "<none>" || -n "${conservar[$t]:-}" ]] && continue
    if (( ${#conservar[@]} < RETENIDAS )); then
        conservar["$t"]=1
        continue
    fi
    info "borrando las imágenes de $t"
    for i in "${IMAGENES[@]}"; do podman image rm "localhost/$i:$t" >/dev/null 2>&1 || true; done
done
info "OK: $tag desplegado"
