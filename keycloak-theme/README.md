# Tema de login de Keycloak (Halsa)

Tema FreeMarker para las páginas de login de Keycloak 26.4 (plan, Apéndice A). Dos variantes:

| Tema              | Realm             | Público                                                                                 |
| ----------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `halsa`           | `halsa`           | Personal de ARL e IPS                                                                   |
| `halsa-pacientes` | `halsa-pacientes` | Pacientes (hereda de `halsa`; cambia el texto, el registro y la verificación de correo) |

Solo es un tema de **login**. La consola de cuenta y la de administración siguen con el tema de Keycloak (fuera de alcance, plan §14).

## Cómo está hecho

- `parent=base`, `import=common/keycloak`, sin PatternFly (`stylesCommon` vacío).
- `themes/halsa/login/theme.properties` asigna **todas** las claves `kc*Class` de Keycloak 26.4 a clases propias `.hl-*` (o a nada). Así, incluso las páginas que no sobreescribimos se ven como Halsa.
- `src/halsa.css` define las clases `.hl-*` con Tailwind v4 e importa `libs/ui/src/tokens.css`, el mismo archivo de tokens de las apps: un cambio de color se ve en todas partes.
- Las plantillas `.ftl` sobreescritas son copias de las de `base` con cambios **solo de marcado**: nunca se renombran campos (`username`, `password`, `otp`, `totp`, `userLabel`, `selectedCredentialId`, …) ni se quitan campos ocultos.
- `resources/js/halsa.js`: modo oscuro según `prefers-color-scheme` antes del primer pintado, solo dígitos en los campos OTP, botón "Copiar" de la clave TOTP y la lista de requisitos de contraseña en vivo. Sin scripts en línea propios.
- Textos en `messages/messages_es.properties` (español de Colombia, "tú"). Solo las claves que cambian; el resto viene del español de Keycloak. El único idioma es `es`, así que no hay selector de idioma.

## Desarrollo

```bash
npm run kc:up         # compila el CSS, levanta Keycloak (8180) + Mailpit (8025) en Podman
npm run theme:watch   # recompila el CSS al guardar
```

Keycloak corre con `start-dev` (sin caché de temas) y monta `themes/` de solo lectura: un cambio en un `.ftl`, en los mensajes o en el CSS se ve al recargar, sin reiniciar el contenedor.

Páginas para revisar:

- Login del personal: <http://localhost:8180/realms/halsa/account>
- Login de pacientes → "Crear cuenta": <http://localhost:8180/realms/halsa-pacientes/account>
- OTP: entra como `calificador.arla` o `medico.ips` (contraseña `dev`) por una URL que pida `acr_values=2` (ver `backofficeAuthUrl` en `e2e/keycloak-theme.spec.ts`), o desde el backoffice en modo mock.
- Configurar OTP: en <http://localhost:8180/admin> (`admin`/`admin`) agrega la acción requerida _Configure OTP_ a `analista.arla` y entra.
- Página expirada: botón Atrás después de pasar el paso de la contraseña.

Las plantillas originales de Keycloak 26.4 sirven de referencia (no se versionan). Para extraerlas en `keycloak-theme/.reference/themes`:

```bash
podman create --name kc-ref quay.io/keycloak/keycloak:26.4
podman cp kc-ref:/opt/keycloak/lib/lib/main ./kc-main
podman rm kc-ref
# descomprime kc-main/org.keycloak.keycloak-themes-26.4.*.jar en keycloak-theme/.reference/themes
```

### Pruebas

```bash
npm run e2e:theme                        # Playwright contra el Keycloak de Podman
npm run e2e:theme -- --update-snapshots  # tras un cambio visual intencional
```

Recorre cada página de ambos realms a 375 px y 1440 px, en claro y oscuro: axe sin violaciones serias ni críticas, ningún texto en inglés, ninguna clase PatternFly/Font Awesome, ninguna imagen rota, sin scroll horizontal, y compara con las líneas base (`e2e/keycloak-theme.spec.ts-snapshots/`). Las capturas del reporte quedan en `docs/reportes/m1.5/`. También prueba los flujos completos: contraseña + OTP de `calificador.arla` y `medico.ips`, y el registro de un paciente nuevo.

## Empaquetado

```bash
npm run theme:build   # → dist/keycloak-theme/halsa-keycloak-theme.jar
```

El JAR contiene `META-INF/keycloak-themes.json` y los temas bajo `theme/<nombre>/login/…`, la estructura que Keycloak espera. Incluye el CSS compilado y las fuentes.

## Instalación en los Keycloak del backend (plan §13 G14)

El frontend entrega el JAR; **no** lo instala. Pasos para el equipo de backend/identidad:

1. **Desarrollo (`../Halsa.Backend`, Keycloak en 8080):** una de estas dos opciones:
   - montar `keycloak-theme/themes/halsa` y `keycloak-theme/themes/halsa-pacientes` en `/opt/keycloak/themes/` del servicio Keycloak del compose (requiere `npm run theme:css` antes), o
   - copiar `halsa-keycloak-theme.jar` a `/opt/keycloak/providers/` y reiniciar.
2. **Realms:** en `halsa-realm.json`, `halsa-pacientes-realm.json` y en `deploy/keycloak/importar-realms.sh`:
   - `"loginTheme": "halsa"` (o `"halsa-pacientes"`),
   - `"internationalizationEnabled": true`, `"supportedLocales": ["es"]`, `"defaultLocale": "es"`.
3. **Producción (`auth.alcast.dev`):** quien administra ese Keycloak compartido copia el JAR a `providers/` y reinicia. Luego selecciona el tema de login en cada realm (o reimporta con el paso 2).

Para comprobarlo: abre `https://<keycloak>/realms/halsa/account`; debe verse "Ingresa a Halsa" con el panel verde azulado y sin estilos de PatternFly.

## Pendiente de producto

- `halsaPrivacyUrl` (en `themes/halsa/login/theme.properties`) apunta a una URL provisional; falta la página real de la política de tratamiento de datos.
- `termsText` es un texto genérico; los términos solo se muestran si se activa la acción requerida _Terms and Conditions_.
