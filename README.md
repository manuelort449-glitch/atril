# Atril — teleprompter para tus tandas

App propia (no es una copia de Parrot) hecha con HTML, CSS y JavaScript, sin librerías externas.
Funciona en **iPad, Android y PC** desde el navegador y se puede agregar a la pantalla de inicio
como si fuera una app.

Ya trae tus **55 notas** y **188 canciones** (66 con letra) sacadas de Parrot Teleprompter en Dropbox.

---

## 1. Cómo arrancarla (lo más fácil)

En la PC, dentro de la carpeta `atril`:

```bash
python server.py
```

Aparecen direcciones como estas:

```
En esta PC:          http://localhost:8765
En iPad / Android:   http://192.168.1.50:8765
Control remoto:      http://192.168.1.50:8765/remote.html
```

1. Conecta el iPad, el Android y la PC a la **misma red WiFi**.
2. En el iPad abre la dirección "En iPad / Android" en Safari → botón Compartir → **Agregar a inicio**.
3. En el Android ábrela en Chrome → menú ⋮ → **Agregar a pantalla principal**.

### ¿Y si no hay internet?

**La PC no necesita internet.** Solo hace falta que todos estén en la misma red.
Si no hay ningún WiFi (por ejemplo en un evento), prende el **punto de acceso / hotspot del Android**
(funciona aunque no tengas datos), conecta el iPad y la PC a ese hotspot y corre `python server.py`.
Todo funciona igual: la app, la sincronización y el control remoto.

---

## 2. Pasar datos entre Android, iPad y PC

Hay tres formas. Las tres **combinan** la información: por cada nota y canción se queda el
cambio más reciente, así que nunca se borra lo que hiciste en el otro aparato.

| Forma | Necesita | Cómo |
|---|---|---|
| **WiFi local** | PC con `server.py`, misma red (sin internet) | Automático: lo que cambias en uno aparece en el otro en 1–2 segundos. |
| **Dropbox** | Internet + configuración única (abajo) | Automático cada vez que abres la app, cambias algo o vuelve la señal. |
| **Archivo** | Nada | Ajustes → *Enviar a otro dispositivo* (WhatsApp, Telegram, correo, Drive…). En el otro: Ajustes → *Recibir archivo*. |

El punto verde arriba a la derecha dice **Sincronizado**; si está rojo, no hay conexión con la PC o con Dropbox
(tus cambios quedan guardados y se envían cuando vuelva la conexión).

### Configurar Dropbox (una sola vez)

1. Entra a <https://www.dropbox.com/developers/apps> → **Create app**.
2. Elige **Scoped access** → **App folder** → ponle un nombre (ej. `Atril`).
3. En *Permissions* marca `files.content.read` y `files.content.write` → **Submit**.
4. En *Settings* → *OAuth 2 / Redirect URIs* agrega la dirección **https** donde publiques la app (ver punto 3),
   por ejemplo `https://tuusuario.github.io/atril/index.html`.
5. Copia el **App key** y pégalo en `config.js`:
   ```js
   window.ATRIL_CONFIG = { dropboxAppKey: "abc123xyz" };
   ```
6. En cada aparato: Ajustes → **Conectar Dropbox**.

Los datos se guardan en `Dropbox/Aplicaciones/Atril/atril-sync.json`.
Dropbox solo funciona cuando la app se abre desde una dirección **https** (no desde `http://192.168…`).

---

## 3. Sin PC y sin internet (GitHub Pages + control por QR)

La app está publicada con **GitHub Pages** (dirección https). Ábrela una vez en el iPad con internet,
agrégala a inicio y desde ahí abre aunque estés en modo avión (`sw.js` la guarda en el aparato).

**Tus datos no se publican.** En GitHub solo va la app: `data/datos.js` está vacío y
`data/mis-datos.js`, `listas/` y `atril-sync.json` están en `.gitignore`. Tus guiones entran al
iPad con el archivo de respaldo: ☰ → Más ajustes y respaldo → **Recibir archivo**.

**Control desde el teléfono sin PC:** los dos en la misma red (el hotspot del teléfono sin datos sirve).
iPad: ☰ → **Conectar control** · teléfono: ☰ → **Usar como control** → escanea el QR del iPad →
muestra el QR del teléfono a la cámara del iPad. Quedan conectados directo (WebRTC), sin servidor.
Después de la primera vez el iPad **recuerda el teléfono**: basta con que el teléfono escanee el código
del iPad (el teléfono guarda un certificado fijo y el iPad su huella). Para otro teléfono: **Usar otro teléfono**.

**Respaldo por internet (v11):** si los dos aparatos tienen internet (WiFi o datos, aunque sea en redes
distintas), al escanear el código del iPad también se conectan a servidores públicos de mensajes (MQTT:
HiveMQ, EMQX y Mosquitto). Todo va **cifrado** (AES-GCM) con una clave que solo viaja dentro del QR:
los servidores no pueden leer nada. Con eso:
- la respuesta del teléfono llega sola al iPad (no hace falta mostrarle el código del teléfono);
- si el enlace directo falla, el control sigue funcionando por internet y el iPad vuelve a intentar el
  directo solo (hasta 3 veces); en el control se ve *Conectado directo* o *Conectado por internet*;
- si el iPad recordaba otro teléfono, ya no lo rechaza: se conecta igual y recuerda el nuevo.
Por internet los archivos (fondo, foto o video del mensaje) pueden ser de hasta 25 MB.
Sin internet funciona como antes (los dos en la misma red WiFi o en el hotspot). La pantalla de conexión
muestra la versión y el estado (*directo* / *internet*) para saber qué está fallando.

### Hacer cambios sin romper lo publicado (ramas)

- `main` = lo que está publicado y usa el iPad.
- `cambios` = donde se prueba lo nuevo. Cuando funciona, se une a `main` y GitHub Pages se actualiza solo.

```bash
git switch cambios
```

Al terminar y probar los cambios, sube el número de `VERSION` en `sw.js` y únelos a `main`.

> **Importante en iPad:** Safari puede borrar los datos de páginas que no visitas en varios días.
> Agregarla a la pantalla de inicio lo evita, y la sincronización (WiFi, Dropbox o archivo) te deja
> siempre una copia en otro lado.

---

## 4. Funciones

**Teleprompter**
- Desplazamiento automático con cuenta regresiva, línea guía, barra de progreso y pantalla siempre encendida.
- **Velocidades:** botones − / + (de 0.5 en 0.5), menú rápido al tocar el número
  (Muy lenta 2 · Lenta 4 · Normal 6 · Rápida 9 · Muy rápida 13 · Máxima 20) y **cada nota recuerda su velocidad**.
- **Barra deslizante de velocidad:** en el menú de velocidad (toca el número) y, en pantallas anchas como el iPad,
  también en la barra de abajo del prompter; se puede mover mientras corre el texto.
- **Tipografías:** del aparato (funcionan sin internet), de **Google Fonts** (gratis; se bajan una vez y quedan
  guardadas, o escribe el nombre de cualquier otra) o un **archivo propio** `.ttf/.otf` (por ejemplo bajado de DaFont).
- **Efectos de letra:** Neón, Neón parpadeante, Brillo que late, Arcoíris, Solo contorno, Sombra 3D y Fuego
  (el neón usa el *Color de fuente*).
- **Cambios de velocidad dentro de la nota:** escribe una línea `[vel 8]` y al llegar a la línea guía cambia sola.
- Saltar a la canción anterior / siguiente, tamaño de letra, espejo horizontal y vertical, mayúsculas.
- Las líneas `-Canción TONO/Canción TONO` se muestran como encabezados con el tono resaltado;
  `MÚSICA`, `TANDA…`, `INTRO` y las líneas `————` se marcan aparte.

**Control remoto**
- Pedal o teclado Bluetooth: `Espacio` iniciar/pausar · `↑ ↓` velocidad · `← →` o `Re Pág / Av Pág` canción ·
  `+ −` letra · `M` espejo · `Inicio` volver arriba · `Esc` salir.
- **Teléfono como control (QR, sin internet):** iniciar/pausar, panel para deslizar, canciones, velocidad con barra,
  letra, y en *Pantalla y fondo del iPad*: márgenes, espejo, colores, tipografía, efecto y fondo.
- **MENSAJE:** en el control escribe un mensaje (y si quieres agrega una foto o un video con 📎) y toca el sobre.
  En el iPad llega un sobre que dice MENSAJE, se abre, sale la foto/video y el texto corre de lado a lado;
  luego vuelve solo a la letra (si iba corriendo, sigue donde iba). Tocar la pantalla lo salta.
- **Intercambio de datos por el enlace:** al conectarse, el iPad y el teléfono se pasan notas, canciones y letras
  (sin internet) y siguen pasándose los cambios mientras estén conectados. Con internet, además, Dropbox.
- Celular como control: abre `…/remote.html` (con `server.py`). Puede abrir notas en el iPad, iniciar/pausar,
  cambiar canción, velocidad (incluye Lenta / Normal / Rápida) y tamaño de letra.

**Notas y canciones**
- **Nueva nota** de tres formas: en blanco (libre), eligiendo canciones en tu orden, o **agrupadas por ritmo**.
- En una nota existente: **Agrupar por ritmo** toma sus canciones y arma una nota nueva ordenada por ritmo.
- Armar tanda: toca canciones para agregarlas o quitarlas (✓), reordénalas, incluye letras y,
  en modo ritmo, opcionalmente pon las del mismo ritmo en una sola línea como en tus notas.
- Lista de canciones con ritmo editable, filtro por ritmo, vista "Por ritmo" y "Solo con letra".
- **Buscar letra en internet** (gratis, sin cuenta): LRCLIB y Lyrics.ovh. Desde la ficha de la canción o con 🔍 en
  Armar tanda; toca un resultado para ver la letra debajo y **Usar esta letra**.
  (Genius no entrega letras por su API). Si no está en esas fuentes: botones **Letras.com**, **Genius**, **Musica.com**
  y **Google** abren la búsqueda; copias la letra, regresas y tocas **Pegar letra** (limpia lo que sobra al copiar).
- En Armar tanda: con **Incluir letras** prendido, cada canción tiene su botón **Letra** para elegir cuáles la llevan
  (o *Todas* / *Ninguna*). Si escribes una canción que no está, aparece **Agregar «…»** y se busca su letra.
- Importar ritmos desde `listas/Lista de canciones.txt` (formato `Canción - Ritmo`).

**Buscador tolerante** (Notas, Canciones, Armar tanda, Insertar canción)
- Ignora acentos y mayúsculas: `bombon` → *Bombón*.
- Palabras en cualquier orden y a medias: `miel amar` → *Hasta la miel amarga*.
- Errores de dedo y de ortografía: `bonbon`, `agitado`, `sinseramente`, `Que me yeve el diablo`, `rengo gayo`.
- Ordena del más parecido al menos parecido; también busca dentro de las letras (con menos peso).

---

## 5. Estructura del proyecto

```
atril/
├── index.html            Estructura de la página y del teleprompter
├── styles.css            Diseño estilo iOS (paleta salvia, malva y lino; modo claro y oscuro)
├── app.js                Toda la lógica (ver índice al inicio del archivo)
├── config.js             Clave de Dropbox
├── data/datos.js         Vacío (es lo que se publica)
├── data/mis-datos.js     Tus notas y canciones, solo en tu PC (generado; no se sube)
├── vendor/               Lectores y generadores de QR (jsQR, qrcode-generator)
├── remote.html           Control remoto para el celular
├── server.py             Servidor local: app + sincronización + control remoto (sin internet)
├── sw.js                 Guarda la app en el aparato para abrir sin internet
├── manifest.webmanifest  Nombre e íconos al agregarla a la pantalla de inicio
├── icon.svg, icon-*.png  Íconos
├── tools/generar_datos.py  Lee Parrot en Dropbox y genera data/datos.js y las listas
└── listas/               Lista de canciones.txt y Canciones con letra.txt
```

Ideas clave por si quieres hacer otro proyecto parecido:

- **Datos locales primero:** todo se guarda en el navegador (`localStorage`), por eso funciona sin conexión.
- **Sincronizar sin perder nada:** cada elemento tiene `ts` (hora del último cambio) y los borrados se marcan
  con `del: true` en vez de eliminarse; al combinar gana el `ts` más alto (`mergeIn` en `app.js`, `merge` en `server.py`).
- **PWA:** `manifest.webmanifest` + `sw.js` hacen que se instale y abra sin internet.
- **Servidor sin dependencias:** `server.py` usa solo la biblioteca estándar de Python
  (Server-Sent Events para avisar cambios y comandos en tiempo real).

### Actualizar con notas nuevas de Parrot

```bash
python tools/generar_datos.py
```

Luego en la app: Ajustes → **Agregar notas nuevas de Dropbox/Parrot** (no toca lo que ya editaste).
Si cambias archivos de la app y la publicas, sube el número de `VERSION` en `sw.js` para que los aparatos se actualicen.
