Los 12 usuarios de prueba de crear-usuarios-prueba.sh están creados y activos (enabled = true), junto con 2 usuarios adicionales en ARL_A:

Usuario (username / email) │ Sub (id) │ Rol(es) │ Atributos (tenant_id / ips_id)
────────────────────────────────────────┼──────────────────────────────────────┼──────────────────────────┼───────────────────────────────────────────────
analista.a@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000a001 │ analista-arl │ actor_tipo=arl; tenant_id=PRUEBA_A
laboral.a@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000a002 │ medico-laboral │ actor_tipo=arl; tenant_id=PRUEBA_A; CC
│ │ │ 99000001; RM-PRUEBA-0003
calificador.a@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000a003 │ medico-calificador, │ actor_tipo=arl; tenant_id=PRUEBA_A; CC
│ │ clinico:emergencia │ 99000002; RM-PRUEBA-0001
privacidad.a@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000a004 │ oficial-privacidad │ actor_tipo=arl; tenant_id=PRUEBA_A
admin.a@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000a005 │ administrador │ actor_tipo=arl; tenant_id=PRUEBA_A
analista.b@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000b001 │ analista-arl │ actor_tipo=arl; tenant_id=PRUEBA_B
laboral.b@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000b002 │ medico-laboral │ actor_tipo=arl; tenant_id=PRUEBA_B; CC
│ │ │ 99000003; RM-PRUEBA-0004
privacidad.b@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000b003 │ oficial-privacidad │ actor_tipo=arl; tenant_id=PRUEBA_B
coordinador.ips1@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000c001 │ coordinador-ips │ actor_tipo=ips; ips_id=990000000001
medico.ips1@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000c002 │ medico-ips │ actor_tipo=ips; ips_id=990000000001; CC
│ │ │ 80000222; RM-PRUEBA-0002
coordinador.ips2@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000c003 │ coordinador-ips │ actor_tipo=ips; ips_id=990000000002
medico.ips2@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000c004 │ medico-ips │ actor_tipo=ips; ips_id=990000000002; CC
│ │ │ 80000333; RM-PRUEBA-0005
edhunter (dameliatus@hotmail.com) │ 8831506e-db54-4b23-96df-06475fbc2ffb │ analista-arl │ actor_tipo=arl; tenant_id=ARL_A
edcastaniohunter@gmail.com │ fe74030a-ea6a-419b-8d19-4867c9883675 │ default-roles-halsa │ actor_tipo=arl; tenant_id=ARL_A
──────

### 2. Realm halsa-pacientes (Portal de Pacientes)

Los 3 pacientes de prueba más 1 cuenta adicional están activos:

Usuario (username / email) │ Sub (id) │ Vínculo en halsa (atel.vinculos_paciente)
────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────────────────────────────
paciente.1@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000d001 │ Vinculado a CC 99100001 (casos A01, A03, A06, B01)
paciente.2@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000d002 │ Vinculado a CC 99100002 (casos A02, A07, A08, B03)
paciente.3@pruebas.halsa.invalid │ 01999f00-0000-7000-8000-00000000d003 │ Sin vínculo inicial (para canjear PRB013-MSRG2YTBS9, caso A13)
dameliatus@hotmail.com │ a09d6586-151f-459d-bb21-660dbf524cb8 │ —

Por ejemplo, para asignarle una nueva contraseña a analista.a@pruebas.halsa.invalid sin borrarlo:

    podman exec -it keycloak /opt/keycloak/bin/kcadm.sh config credentials \
      --server http://localhost:8080 --realm master --user edhunter

    # Reemplaza <NUEVA_CLAVE> (con --temporary si quieres que la cambie al entrar, o sin --temporary para dejarla fija)
    podman exec -it keycloak /opt/keycloak/bin/kcadm.sh set-password \
      -r halsa --username analista.a@pruebas.halsa.invalid --new-password '<NUEVA_CLAVE>' --temporary
