# Confluence MJMC

Confluence MJMC es una potente interfaz de una sola página (SPA) para interactuar con Confluence. Permite buscar, hacer preguntas, visualizar y crear/actualizar páginas de forma rápida y eficiente, todo desde una interfaz de usuario limpia y oscura.

Esta herramienta está diseñada para usuarios avanzados de Confluence que desean una forma más rápida y directa de interactuar con su base de conocimientos.

## Características

*   **Búsqueda Avanzada**: Soporte para consultas en **lenguaje de consulta de Confluence (CQL)** y búsqueda de texto libre.
*   **Preguntas y Respuestas (RAG-lite) con Contexto Dual**:
    *   Responde preguntas utilizando como base de conocimiento las páginas de Confluence.
    *   **¡Nuevo!** Puede usar el contenido de una **URL externa** como contexto para responder preguntas, permitiendo consultar fuentes de la web.
*   **Extracción de Contenido Web**: La función 'Extraer de Enlace' ahora utiliza un algoritmo mejorado para limpiar el HTML y extraer solo el contenido principal del artículo, ignorando menús, anuncios y otros elementos irrelevantes.
*   **Inteligencia de Intenciones**: Detecta la intención del usuario (p. ej., buscar, definir, crear) para sugerir acciones y construir consultas CQL automáticamente.
*   **Creación y Actualización de Páginas**: Crea nuevas páginas o actualiza las existentes directamente desde la interfaz.
*   **Vista Previa de Contenido**: Previsualiza el contenido HTML antes de publicarlo en Confluence.
*   **Caché Local**: Utiliza el `localStorage` del navegador para cachear páginas y credenciales, agilizando las visitas posteriores.
*   **Proxy CORS Opcional**: Incluye un servidor proxy para evitar problemas de Cross-Origin Resource Sharing (CORS) si es necesario.

## ¿Cómo funciona?

La aplicación es un único archivo `index.html` que se puede abrir directamente en el navegador. Se comunica con la API REST de Confluence.

Debido a las restricciones de seguridad de los navegadores (CORS), las solicitudes directas a la API de Confluence desde un archivo local (`file://`) o un dominio diferente probablemente fallarán. Para solucionar esto, el proyecto incluye un **servidor proxy CORS** que también proporciona el servicio de extracción de contenido web.

## Instalación y Uso

Hay dos formas de usar Confluence MJMC:

### 1. Uso Directo (con Proxy)

Esta es la forma recomendada para la mayoría de los usuarios. Se ejecuta un pequeño servidor proxy en su máquina local para reenviar las solicitudes a Confluence, evitando problemas de CORS.

**Requisitos:**
*   [Node.js](https://nodejs.org/) (versión 16 o superior)
*   npm (incluido con Node.js)

**Pasos de instalación del proxy:**

1.  **Clonar o descargar el repositorio:**
    ```bash
    git clone <url-del-repositorio>
    cd <directorio-del-repositorio>
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar el proxy (opcional):**
    Cree un archivo `.env` en la raíz del proyecto para configurar las variables de entorno del proxy.
    *   `PORT`: Puerto en el que se ejecutará el proxy (por defecto: `8787`).
    *   `ALLOWED_HOSTS`: Lista de hosts de Confluence permitidos, separados por comas (p. ej., `TUORG.atlassian.net`). **¡Esto es importante por seguridad!**
    *   `ALLOWED_ORIGINS`: Orígenes permitidos para realizar solicitudes al proxy. Si abre `index.html` localmente, no necesita configurar esto. Si lo aloja, ponga su dominio aquí.

4.  **Iniciar el servidor proxy:**
    ```bash
    npm start
    ```
    El proxy se estará ejecutando en `http://localhost:8787`.

**Uso de la aplicación:**

1.  Abra el archivo `index.html` en su navegador web.
2.  Haga clic en **⚙️ Configuración**.
3.  Complete los detalles de la conexión:
    *   **Base URL**: La URL de su instancia de Confluence (p. ej., `https://TUORG.atlassian.net/wiki`).
    *   **CORS Proxy URL**: La URL de su proxy local (`http://localhost:8787/forward?url=`).
    *   **Correo (Basic Auth)**: Su correo electrónico de Confluence.
    *   **API Token / OAuth Bearer**: Su token de API de Confluence.
4.  Haga clic en **Guardar**. ¡Ya está listo para usar la aplicación!

### 2. Despliegue como Extensión Interna o en el mismo dominio

Si puede alojar el archivo `index.html` en el mismo dominio que su Confluence o si lo empaqueta como una extensión de navegador, no necesita el proxy. En ese caso, simplemente deje en blanco el campo "CORS Proxy URL" en la configuración.

## Guía de Uso

*   **Búsqueda en Confluence**: Utilice el cuadro de búsqueda principal para buscar por texto libre o CQL. Los resultados aparecerán debajo.
*   **Extraer Contenido Web**: Pegue una URL en el cuadro "Extraer de Enlace" y haga clic en "Extraer". Verá una versión limpia del texto principal del artículo en la caja de resultados de esa sección.
*   **Preguntas y Respuestas**:
    *   **Sobre Confluence**: Deje el cuadro "Extraer de Enlace" vacío. Escriba una pregunta en "Pregúntale a tu Confluence" y haga clic en "Responder". La respuesta se basará en las páginas de Confluence (puede realizar una búsqueda primero para acotar el contexto).
    *   **Sobre un Enlace Externo**: Primero, pegue una URL en el cuadro "Extraer de Enlace". Luego, escriba su pregunta en "Pregúntale a tu Confluence" y haga clic en "Responder". La respuesta se basará *únicamente* en el contenido de la página web que proporcionó.
    *   Las respuestas siempre aparecerán en la tarjeta dedicada "Respuesta".
*   **Crear/Actualizar**: Utilice el formulario "Crear / Actualizar Página". Si una página con el mismo título existe en el espacio especificado, se actualizará; de lo contrario, se creará una nueva.

## Nota de Seguridad

Las credenciales (correo y token) se almacenan en el `localStorage` de su navegador. Esto es razonablemente seguro para uso local, pero tenga cuidado si utiliza la herramienta en una computadora compartida.
