# Varrock Desk

Panel en vivo para operar en el Grand Exchange de Old School RuneScape.

- **Mercado:** flips con margen neto después de impuesto, cantidad limitada a lo que el mercado realmente transa y caídas bruscas frente al promedio de 24 horas.
- **Oscilaciones:** objetos caros que suben y bajan dentro de un rango, con piso, techo, vueltas completas en 90 días y prueba histórica de comprar en el piso y vender en el techo.
- **Mi equipo:** seguimiento de sets y piezas de equipo, con precio objetivo, rango de 90 días y zona de compra.
- **Actualizaciones:** cruza cada noticia del juego con el precio de los objetos que menciona, para ver si el mercado se anticipó o reaccionó después.
- **Mi mesa:** plan para los slots del Grand Exchange, posiciones abiertas e historial de ganancias.

## Cómo funciona

La página es estática y lee los precios en vivo desde la [API de precios del OSRS Wiki](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices).

El análisis de oscilaciones revisa cientos de objetos, así que se calcula una vez al día con GitHub Actions (`.github/workflows/oscilaciones.yml`). El script `scan.js` usa el mismo análisis que la página (`swing.js`) y deja el resultado en `oscilaciones.json`. Para correrlo a mano: pestaña Actions, flujo Oscilaciones, Run workflow.

Los datos personales (objetivos, posiciones, historial) se guardan en el navegador. Para pasarlos a otro dispositivo, usa Exportar e Importar al pie de la página.

Sitio independiente, sin afiliación con Jagex.
