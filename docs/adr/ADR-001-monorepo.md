# ADR-001: Uso de Monorepo

## Estado
Aceptado

## Contexto
El proyecto ERP incluye backend, frontend, documentación e infraestructura.
Se requiere mantener consistencia entre versiones y facilitar el despliegue.

## Decisión
Se adopta una estructura **monorepo** que contiene todos los componentes
del sistema en un solo repositorio.

## Consecuencias
- Mayor visibilidad del proyecto completo
- Versionado unificado
- Requiere disciplina en la estructura de carpetas