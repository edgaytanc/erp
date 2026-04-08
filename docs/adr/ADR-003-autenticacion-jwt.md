# ADR-003: Autenticación mediante JWT

## Estado
Aceptado

## Contexto
El sistema requiere autenticación segura para múltiples usuarios y roles,
incluyendo futuras integraciones con frontend React.

## Decisión
Se utilizará **JWT (JSON Web Tokens)** para la autenticación y autorización
de usuarios en la API.

## Consecuencias
- Backend desacoplado del frontend
- Escalable para futuras integraciones
- Manejo explícito de tokens en frontend
