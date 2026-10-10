# PROMPT PARA CLAUDE: ARQUITECTURA FRONTEND - PLATAFORMA MÉDICA ARL COLOMBIA

**Rol:** Actúa como Arquitecto Frontend, Especialista en Angular y Experto en Integración de Interfaces HealthTech seguras.

**Contexto del Proyecto:**
Necesito diseñar la arquitectura del cliente frontend para una plataforma SaaS enfocada en la gestión de siniestros laborales (ATEL) para ARLs en Colombia. La plataforma será utilizada por pacientes, médicos auditores y personal administrativo, por lo que la seguridad, el rendimiento y la separación por roles son críticos.

**IMPORTANTE - REGLA DE EJECUCIÓN:**
No comiences a diseñar los modelos de datos del cliente, los servicios HTTP, ni la estructura de los BFF (Backend for Frontend) hasta que yo te proporcione el archivo/contrato `api.spec` (OpenAPI/Swagger) generado por el equipo de Backend. Responde a este prompt únicamente confirmando que has entendido el contexto y que estás a la espera del `api.spec` para comenzar.

**Stack Tecnológico Definido:**

- **Frontend:** Angular 21+ (Standalone Components, Signals, Arquitectura DDD).
- **Gestión de Identidad (IdP):** Integración con Keycloak (OAuth2, OpenID Connect) para SSO.

---

## 1. REQUERIMIENTOS ARQUITECTÓNICOS (A implementar tras recibir el api.spec)

Una vez te entregue el contrato de la API, deberás generar lo siguiente:

1. **Arquitectura DDD en Angular 21+:**
   - Estructura de dominios (ej. Administrativo, Clínico, Paciente).
   - Uso de Standalone Components y manejo de estado reactivo utilizando Signals.
2. **Flujo de Autorización y Seguridad UI:**
   - Explicación técnica y código base de cómo Angular maneja la redirección a Keycloak.
   - Implementación de un HttpInterceptor para adjuntar el JWT en las peticiones al BFF.
   - Implementación de Route Guards y directivas estructurales personalizadas (ej. `*hasRole`) para ocultar/mostrar elementos de la UI basándose en los claims de Keycloak (RBAC/ABAC), garantizando que un perfil administrativo no pueda renderizar componentes clínicos.
3. **Integración del Portal Paciente (BFF):**
   - Estructura de los servicios en Angular para consumir los estados del caso, notificaciones de citas y resoluciones, utilizando tokens JWT de corto alcance.

**Tu primera tarea:** Confirma que has adoptado el rol, que comprendes el stack tecnológico y confirma que estás en estado de espera para recibir el `api.spec` del backend.
