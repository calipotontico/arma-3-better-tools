# Arma 3 Better Tools

Editor de modelos y exportador de addons para Arma 3, con interfaz en español e inglés.

## Preparar y ejecutar

Requisitos: Windows x64, Node.js 22 LTS y npm. Para generar PBO se necesita una instalación local de Arma 3 Tools, cuya carpeta se selecciona en los ajustes. Arma 3 y sus herramientas no están incluidos.

~~~sh
npm ci
npm run dev
~~~

Para abrir la aplicación de escritorio:

~~~sh
npm run desktop
~~~

## Comprobar y crear un instalador

~~~sh
npm test
npm run build
npm run build:installer
~~~

El instalador completo queda en release/installer-VERSION/. La primera compilación necesita internet para descargar las dependencias y herramientas de empaquetado. El instalador resultante no necesita descargar la aplicación de un servidor.

Esta distribución tiene las actualizaciones automáticas desactivadas y no inicializa el actualizador. No contiene infraestructura ni credenciales de publicación. Poly Haven sigue utilizando su API pública cuando el usuario abre la biblioteca o descarga un recurso; esta copia no es una aplicación completamente sin conexión.

## Alcance de esta copia

Instantánea del código del 22 de octubre de 2026. Conserva la versión base 0.3.14 y puede incluir trabajo posterior aún no publicado, incluida la creación de ventanas desde caras. No equivale al instalador estable ya distribuido. Verifica los addons dentro de Arma 3 antes de distribuirlos.

Los proyectos, cachés y ajustes se generan en el equipo de cada usuario; no se incluyen proyectos personales ni historial Git. Para comenzar un repositorio, utiliza únicamente esta carpeta. No añadas exportaciones, partidas, proyectos ni credenciales.

## Recursos y licencia

Licencia propia de uso y distribución gratuita: consulta LICENSE.txt y THIRD_PARTY_NOTICES.md. Puedes usar, estudiar, modificar y compartir gratis el programa. No se permite venderlo ni cobrar por sus versiones modificadas o por desarrollar modificaciones. Las donaciones deben ser voluntarias y no dar acceso exclusivo a funciones o versiones.

Esta restricción no se aplica a los modelos y addons creados con el editor; sus recursos mantienen sus propias licencias. El código es público, pero no se presenta como «open source».

English summary: source-available software, free use and redistribution only. Selling the application, charging for access or modifications, and paid development of modifications are prohibited. User-created models and addons are outside this restriction, subject to their own resource licenses. See LICENSE.txt for the governing terms in Spanish.

Comunidad: https://discord.gg/g5WJfUxcRj
