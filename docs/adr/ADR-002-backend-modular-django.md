# ADR-002: Backend modular con Django Apps

## Estado
Aceptado

## Contexto
El sistema ERP está dividido en módulos funcionales claros:
Inventario, Ventas, Compras y Configuración.

## Decisión
Se utilizarán **Django Apps independientes** para cada módulo del ERP,
agrupadas dentro del backend.

## Consecuencias
- Código más mantenible
- Posibilidad de escalar o desacoplar módulos
- Curva de aprendizaje ligeramente mayor
