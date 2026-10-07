# Manual de Usuario: Carga Masiva y Ajuste de Stock Físico

**Módulo:** Administración y Configuración / Inventario y Kárdex  
**Audiencia:** Administradores del Sistema, Auditores de Inventario, Encargados de Bodega y Sucursales  
**Versión del Documento:** 1.0.0  
**Fecha de Publicación:** Octubre 2026  

---

## 1. Objetivo del Proceso y Regla de Negocio del Kárdex

Este manual describe el funcionamiento y los lineamientos operativos para utilizar la herramienta de **Carga Masiva de Stock Físico** mediante archivos en formato **CSV** (*Comma-Separated Values*) dentro del sistema ERP.

La herramienta está diseñada para resolver dos escenarios críticos en la operación del negocio:
1. **Cargas iniciales de inventario:** Cuando se apertura una nueva sucursal o se migra el catálogo por primera vez y se requiere establecer las existencias de arranque.
2. **Ajustes por auditorías o conteos físicos:** Cuando se ejecutan inventarios periódicos (ciegos, cíclicos o anuales) y es indispensable sincronizar las existencias físicas en bodega con las registradas en el sistema.

---

### Regla Fundamental de Negocio

> [!IMPORTANT]
> **El sistema no sobrescribe ciegamente el inventario.**  
> El motor de inventario toma la cantidad física declarada en el archivo CSV (`physical_qty`), la compara matemáticamente contra la existencia actual registrada en la base de datos para esa sucursal (`qty_on_hand`) y genera un movimiento de **AJUSTE** (positivo o negativo) en el **Kárdex** de forma automática y auditable.

```
Diferencia = Cantidad Física Declarada (CSV) - Stock Actual en Sistema
```

A partir de este cálculo, el ERP clasifica automáticamente cada fila en una de las siguientes tres situaciones:

* **Ajuste Positivo / Entrada (`IN`):** Si la cantidad contada en estantes es **mayor** que la del sistema (`Diferencia > 0`), se detecta un sobrante físico. El sistema genera un movimiento de entrada por la diferencia exacta, aumentando el stock hasta igualar el conteo.
* **Ajuste Negativo / Salida (`OUT`):** Si la cantidad contada en estantes es **menor** que la del sistema (`Diferencia < 0`), se detecta un faltante o merma. El sistema genera un movimiento de salida por la diferencia exacta, reduciendo el stock hasta igualar el conteo.
* **Sin Cambios (`sin_cambios`):** Si la cantidad contada coincide exactamente con el inventario registrado (`Diferencia = 0`), el sistema **no genera movimientos redundantes** en el Kárdex, manteniendo el historial limpio y contabilizando el registro como conciliado sin variación.

### Integridad Transaccional y Auditoría
Toda la operación se ejecuta bajo un esquema de **transacción atómica (`transaction.atomic`)**. Esto garantiza que si una sola fila del archivo contiene errores de validación (por ejemplo, un SKU inválido o un número mal digitado), **ningún registro será modificado ni ajustado**, protegiendo la base de datos contra inconsistencias parciales. Además, cada movimiento registra el usuario administrador que subió el archivo, la fecha y hora exacta, las existencias antes y después, y la justificación provista.

<div style="page-break-after: always;"></div>

## 2. Ubicación y Acceso en el Sistema

Para acceder a la funcionalidad de carga masiva de stock, el usuario debe haber iniciado sesión con una cuenta que posea el rol de **Administrador** (`admin`).

### 2.1 Pasos para acceder al panel de importación

1. Inicie sesión en la plataforma ERP con sus credenciales administrativas.
2. En la barra de navegación lateral izquierda, haga clic en el módulo de **Configuración** (identificado con el ícono de engranaje). La ruta de acceso es `/admin/config`.
3. En la barra superior de pestañas del panel de Configuración, seleccione la pestaña **Importar** (identificada con el ícono de subida de archivos).
4. Desplácese hacia la segunda sección de la pantalla, titulada **"Carga masiva de stock físico (Inventario)"** y distinguida con la etiqueta **`STOCK / KÁRDEX CSV`**.

![Acceso a la sección de Carga Masiva de Stock Físico](../../assets/images/admin_config_stock_import_section.png)
> **Nota para el desarrollador:** Aquí debes insertar una captura de pantalla que muestre la nueva sección de importación de stock en el panel de configuración, con los botones 'Importar y ajustar stock' y 'Descargar muestra de stock'.

---

### 2.2 Obtención del Código UUID de la Sucursal (`branch_id`)

Para aplicar el ajuste al almacén correcto, el archivo CSV requiere el identificador único universal (**UUID**) de la sucursal. 

Para consultar y copiar este identificador:
1. Dentro del mismo módulo de **Configuración** (`/admin/config`), haga clic en la pestaña **Sucursales**.
2. En el listado de sucursales registradas, localice la sucursal destino.
3. Observe el código alfanumérico ubicado directamente **debajo del nombre de cada sucursal**. Este código tiene un formato de 36 caracteres con guiones (ejemplo: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).
4. Copie este valor exactamente para pegarlo en la columna `branch_id` de su archivo CSV.

![Visualización del código UUID en la pestaña Sucursales](../../assets/images/admin_branches_uuid_view.png)
> **Nota para el desarrollador:** Aquí debes insertar una captura de pantalla de la pestaña 'Sucursales' mostrando el listado donde se visualiza el código UUID debajo del nombre de cada sucursal.

<div style="page-break-after: always;"></div>

## 3. Preparación y Estructura del Archivo CSV

Antes de realizar la carga, debe organizar la información en su programa de hojas de cálculo de preferencia (Microsoft Excel, Google Sheets o LibreOffice Calc) y guardarlo en formato delimitado por comas (`.csv`).

### 3.1 Especificaciones Técnicas del Archivo

* **Extensión obligatoria:** `.csv` (archivos `.xlsx` o `.xls` serán rechazados automáticamente).
* **Codificación requerida:** `UTF-8` o `UTF-8 con BOM` (esta última previene alteraciones con tildes, eñes o caracteres especiales al exportar desde Microsoft Excel).
* **Separador de campos:** Coma (`,`). Si los textos contienen comas internas, deben ir encerrados entre comillas dobles (ejemplo: `"Inventario Anual, Bodega 1"`).
* **Separador decimal:** Punto (`.`). Por ejemplo: `150.00` o `12.50`. Evite usar coma decimal (`150,00`).
* **Fila de encabezados:** La primera fila del archivo debe contener estrictamente los nombres de las columnas en minúsculas, sin espacios ni caracteres especiales.

---

### 3.2 Detalle de Columnas del Archivo

El archivo CSV de stock se compone de **4 columnas estándar** (3 obligatorias y 1 opcional):

| Columna | Obligatoriedad | Tipo de Dato | Formato / Restricción | Descripción y Reglas de Negocio |
| :--- | :--- | :--- | :--- | :--- |
| `sku` | **Obligatorio** | Alfanumérico | Texto (máx. 60 caracteres) | **Código único del producto en el ERP.** No distingue mayúsculas ni minúsculas (el sistema lo normaliza a mayúsculas). Debe corresponder a un producto previamente creado y activo en el catálogo. |
| `branch_id` | **Obligatorio** | UUID | 36 caracteres con guiones | **Identificador único de la sucursal.** Define en qué almacén físico se aplicará el conteo. Puede consultarse en la pestaña *Sucursales* bajo el nombre de cada sucursal. |
| `physical_qty` | **Obligatorio** | Numérico Decimal | Mayor o igual a cero (`>= 0.00`) | **Cantidad exacta contada físicamente en estanterías.** Solo acepta valores numéricos. Si un producto no tiene existencia física real en bodega, coloque `0` o `0.00` (no deje la celda vacía). |
| `note` | *Opcional* | Texto libre | Texto (máx. 255 caracteres) | **Justificación o motivo del ajuste.** Texto explicativo que quedará registrado en el Kárdex (ej: *"Inventario Anual 2026"*, *"Merma por rotura detectada en auditoría"*). Si se omite o queda en blanco, el sistema asignará la nota por defecto: `"Inventario Físico / Ajuste por CSV"`. |

![Estructura del archivo CSV de stock en Excel](../../assets/images/stock_csv_template_excel.png)
> **Nota para el desarrollador:** Aquí debes insertar una captura de pantalla que muestre el archivo CSV abierto en una hoja de cálculo (Excel o Google Sheets) destacando los encabezados 'sku', 'branch_id', 'physical_qty' y 'note' con filas de datos de ejemplo.

> [!WARNING]
> **No duplique combinaciones de SKU y Sucursal dentro del mismo archivo.**  
> Si una fila declara el conteo de un producto en una sucursal, no puede existir otra fila en el mismo archivo con el mismo `sku` y el mismo `branch_id`. En caso de conteos parciales en diferentes estanterías, sume las cantidades antes de ingresar el valor final en el archivo.

<div style="page-break-after: always;"></div>

## 4. Ejemplos Prácticos de Archivos CSV

A continuación se ilustra cómo estructurar el archivo con casos operativos comunes: ajustes por sobrante, ajustes por faltante, productos sin variación y cargas iniciales.

### 4.1 Simulación en Tabla (Vista Hoja de Cálculo / Excel)

Supongamos que en la sucursal **Central** (`3fa85f64-5717-4562-b3fc-2c963f66afa6`) y la sucursal **Zona 10** (`7c9e6679-7425-40de-944b-e07fc1f90ae7`) se realizó una auditoría física:

| sku | branch_id | physical_qty | note |
| :--- | :--- | :--- | :--- |
| `JAB-FAC-01` | `3fa85f64-5717-4562-b3fc-2c963f66afa6` | 50.00 | Inventario Anual 2026 |
| `LIC-WHI-12` | `3fa85f64-5717-4562-b3fc-2c963f66afa6` | 18.00 | Ajuste por auditoría física |
| `DET-MULT-05` | `3fa85f64-5717-4562-b3fc-2c963f66afa6` | 0.00 | Bodega en cero por merma |
| `AGU-MIN-600` | `3fa85f64-5717-4562-b3fc-2c963f66afa6` | 120.00 |  |
| `JAB-FAC-01` | `7c9e6679-7425-40de-944b-e07fc1f90ae7` | 35.00 | Carga inicial Sucursal Zona 10 |

---

### 4.2 Formato de Texto Plano (CSV Raw)

Este es el contenido exacto en texto plano que debe contener el archivo delimitado por comas (`.csv`):

```csv
sku,branch_id,physical_qty,note
JAB-FAC-01,3fa85f64-5717-4562-b3fc-2c963f66afa6,50.00,Inventario Anual 2026
LIC-WHI-12,3fa85f64-5717-4562-b3fc-2c963f66afa6,18.00,Ajuste por auditoría física
DET-MULT-05,3fa85f64-5717-4562-b3fc-2c963f66afa6,0.00,Bodega en cero por merma
AGU-MIN-600,3fa85f64-5717-4562-b3fc-2c963f66afa6,120.00,
JAB-FAC-01,7c9e6679-7425-40de-944b-e07fc1f90ae7,35.00,Carga inicial Sucursal Zona 10
```

---

### 4.3 Interpretación del Motor de Inventario frente al Ejemplo

Para entender cómo procesará el sistema las filas anteriores, analicemos el comportamiento ante diferentes estados previos de la base de datos:

| Producto / SKU | Stock Previo en Sistema | Cantidad Física (CSV) | Diferencia Calculada | Movimiento Kárdex Generado | Stock Final | Nota Registrada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `JAB-FAC-01` | `42.00` | `50.00` | `+8.00` | **Entrada (IN) - Ajuste** | `50.00` | *"Inventario Anual 2026"* |
| `LIC-WHI-12` | `23.00` | `18.00` | `-5.00` | **Salida (OUT) - Ajuste** | `18.00` | *"Ajuste por auditoría física"* |
| `DET-MULT-05` | `4.00` | `0.00` | `-4.00` | **Salida (OUT) - Ajuste** | `0.00` | *"Bodega en cero por merma"* |
| `AGU-MIN-600` | `120.00` | `120.00` | `0.00` | *Ninguno (Sin cambios)* | `120.00` | *(No genera movimiento redundante)* |
| `JAB-FAC-01` (Zona 10) | `0.00` | `35.00` | `+35.00` | **Entrada (IN) - Ajuste** | `35.00` | *"Carga inicial Sucursal Zona 10"* |

> [!TIP]
> En la fila de `AGU-MIN-600`, como la cantidad en el sistema y la contada eran idénticas (`120.00`), el sistema omite escribir una transacción vacía, optimizando el rendimiento y la legibilidad de los reportes contables. En `AGU-MIN-600`, al no especificarse nota, si hubiese existido diferencia se habría asignado la nota automática `"Inventario Físico / Ajuste por CSV"`.

<div style="page-break-after: always;"></div>

## 5. Proceso de Ejecución de la Carga Masiva

Una vez recolectados los conteos físicos y preparado el archivo `.csv`, siga estos sencillos pasos para aplicar el inventario en el ERP:

### Paso 1: Descargar la Plantilla de Muestra (Opcional pero Recomendado)
1. Ingrese a **Configuración** > pestaña **Importar**.
2. En la sección **"Carga masiva de stock físico (Inventario)"**, haga clic en el botón secundario **"Descargar muestra de stock"**.
3. El navegador descargará de inmediato el archivo `inventario_fisico_muestra.csv`, el cual contiene las cabeceras exactas y ejemplos válidos con sucursales y productos reales de su base de datos.

### Paso 2: Seleccionar el Archivo Preparado
1. En el campo **"Seleccionar archivo CSV de stock físico"**, haga clic sobre el explorador de archivos o arrastre el documento.
2. Seleccione el archivo `.csv` que contiene sus datos de conteo. Verifique que el nombre del archivo seleccionado aparezca en el formulario.

### Paso 3: Ejecutar la Importación y el Ajuste
1. Presione el botón principal **"Importar y ajustar stock"**.
2. El botón cambiará automáticamente al estado transitorio **"Ajustando stock..."** mientras el servidor analiza las columnas, verifica la existencia de SKUs y sucursales, y procesa los deltas de ajuste en una sola transacción segura.

### Paso 4: Verificación del Resumen de Éxito
Cuando el proceso concluya satisfactoriamente, se mostrará una alerta de color verde en pantalla con las métricas finales de la operación:
* **Mensaje:** *"Carga masiva finalizada con éxito. Ajustados: X, Sin cambios: Y."*
* **Ajustados:** Total de productos cuya existencia varió y generaron movimiento en el Kárdex.
* **Sin cambios:** Total de productos cuyo conteo físico coincidió con el stock del sistema y no requirieron ajuste.

![Confirmación de carga masiva de stock exitosa](../../assets/images/stock_import_success_alert.png)
> **Nota para el desarrollador:** Aquí debes insertar una captura de pantalla que muestre la alerta verde de éxito con el mensaje de confirmación y el conteo de registros ajustados y sin cambios.

<div style="page-break-after: always;"></div>

## 6. Manejo de Errores Comunes y Soluciones

El validador del ERP inspecciona exhaustivamente cada línea del archivo antes de aplicar cualquier cambio. Si se detecta una o más anomalías, la importación se detiene por completo y se despliega un panel de alerta rojo con el número de línea, el SKU afectado y la causa específica del fallo.

![Reporte de errores en la carga de stock](../../assets/images/stock_import_error_report.png)
> **Nota para el desarrollador:** Aquí debes insertar una captura de pantalla que muestre el recuadro rojo de alerta con la lista de errores encontrados en el archivo (ej. línea, SKU y descripción del problema).

---

### Casos de Error Frecuentes y Cómo Resolverlos

A continuación se detallan los escenarios de error más comunes durante la carga masiva:

#### 1. SKU que no existe en el catálogo
* **Mensaje del sistema:** `Línea X (SKU: ABC-99): No existe el producto con SKU 'ABC-99'.`
* **Causa:** El código de producto ingresado no está registrado en la base de datos de productos del ERP o fue escrito con un error tipográfico.
* **Solución:** Corrija el SKU en el CSV verificando el catálogo oficial en el módulo de Inventario. Si se trata de un artículo nuevo, debe crearlo primero (manualmente o mediante la *Carga Masiva de Productos*) antes de poder asignarle stock.

#### 2. Cantidades en blanco o vacías
* **Mensaje del sistema:** `Línea X (SKU: PROD-01): El campo 'physical_qty' es obligatorio.`
* **Causa:** Se omitió el valor de la columna `physical_qty` o la celda quedó en blanco en la hoja de cálculo.
* **Solución:** Ingrese siempre un número. Si el conteo arrojó que no hay existencias en bodega, escriba explícitamente `0` o `0.00`. Nunca deje celdas de cantidad vacías.

#### 3. Uso de letras, símbolos o formatos de moneda en cantidades
* **Mensaje del sistema:** `Línea X (SKU: PROD-02): El campo 'physical_qty' debe ser un número válido.`
* **Causa:** La celda contiene texto (ej: *"diez"*), abreviaturas (ej: *"10 un"*), símbolos monetarios (ej: *"Q50.00"* o *"$10"*) o separadores de coma decimal (ej: *"10,50"*).
* **Solución:** Escriba únicamente números arábigos utilizando punto (`.`) como separador de decimales (ejemplo: `10` o `10.50`).

#### 4. Cantidades físicas negativas
* **Mensaje del sistema:** `Línea X (SKU: PROD-03): El campo 'physical_qty' debe ser mayor o igual a 0.`
* **Causa:** Se ingresó un número menor que cero (ejemplo: `-5.00`).
* **Solución:** Físicamente no pueden existir cantidades negativas en una bodega. Ingrese valores mayores o iguales a cero (`0.00`).

#### 5. Código UUID de sucursal inválido o inexistente
* **Mensaje del sistema:** `Línea X (SKU: PROD-04): No existe la sucursal con ID '12345'.`
* **Causa:** El campo `branch_id` contiene un identificador incorrecto, incompleto o que no corresponde a ninguna sucursal registrada.
* **Solución:** Diríjase a la pestaña **Sucursales** en Configuración y copie el UUID íntegro (formato de 36 caracteres: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

#### 6. Producto y Sucursal duplicados en el mismo archivo
* **Mensaje del sistema:** `Línea X (SKU: PROD-05): El producto con SKU 'PROD-05' y sucursal '...' está duplicado en el archivo.`
* **Causa:** El archivo contiene dos o más filas con el mismo `sku` para la misma sucursal.
* **Solución:** Consolide el conteo en una sola fila. Sume las cantidades contadas y deje únicamente una fila por producto y sucursal.

#### 7. Encabezados de columna faltantes o mal escritos
* **Mensaje del sistema:** `El archivo CSV no contiene las columnas obligatorias: physical_qty, sku`
* **Causa:** La primera fila del archivo no contiene las cabeceras exactas o fueron escritas con tildes, mayúsculas imprevistas o espacios accidentales.
* **Solución:** Asegúrese de que la primera fila contenga textualmente: `sku,branch_id,physical_qty,note`.

<div style="page-break-after: always;"></div>

## 7. Trazabilidad y Auditoría en el Kárdex

Una de las mayores virtudes de este proceso es que **garantiza el cumplimiento de normas de auditoría contable y control interno**:

1. **Historial Inmutable:** Cada ajuste genera un registro permanente en la tabla de movimientos de inventario (`inventory_movement`).
2. **Tipo de Referencia `ADJUSTMENT`:** Los movimientos quedan catalogados inequívocamente con el tipo de referencia **Ajuste** (*ADJUSTMENT*), lo que permite a los auditores filtrar y segregar ventas, compras y ajustes en los reportes de Kárdex.
3. **Auditoría de Usuario:** El registro almacena el identificador del usuario administrador (`created_by`) que ejecutó la importación, impidiendo alteraciones anónimas del inventario.
4. **Visibilidad de Existencia Previa y Posterior:** El Kárdex guarda tanto el saldo antes del movimiento (`stock_before`) como el saldo resultante tras la operación (`stock_after`), facilitando el cálculo financiero de mermas o sobrantes para el departamento contable.

---

## 8. Buenas Prácticas y Recomendaciones Operativas

Para asegurar el éxito en las auditorías de inventario físico, sugerimos seguir las siguientes recomendaciones:

* **Realizar conteos en horarios no operativos:** Ejecute las tomas de inventario al cierre de tienda o antes de la apertura. Si se realizan ventas mientras se digita el conteo, el stock en sistema variará y generará una discrepancia artificial.
* **Descargue siempre la plantilla actualizada:** Utilice el botón **"Descargar muestra de stock"** para disponer de una base libre de errores de sintaxis y verificar los identificadores de sucursales vigentes.
* **Estructure conteos por sucursal:** Aunque el sistema soporta archivos con múltiples sucursales combinadas, se recomienda subir un archivo por sucursal para facilitar la validación y el rastreo de incidencias.
* **Documente siempre la columna `note`:** Ingrese notas descriptivas como *"Inventario Anual Octubre 2026 - Conteo ciego por Auditoría Externa"* o *"Ajuste merma estantería dañada"*. Esto facilitará enormemente las revisiones fiscales y los cierres de fin de año.
