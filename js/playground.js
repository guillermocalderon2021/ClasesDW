/*
  Lógica compartida de los ejemplos interactivos (playground).
  Este archivo depende de CodeMirror (modos xml, css y htmlmixed),
  cargado previamente desde el CDN en cada página HTML.

  Estructura esperada por cada bloque ".playground":

    <div class="playground">
      <div class="paneles-editor">
        <div class="panel-editor">
          <span class="etiqueta">HTML</span>
          <textarea class="codigo-html">...código inicial...</textarea>
        </div>
        <div class="panel-editor">
          <span class="etiqueta">CSS</span>
          <textarea class="codigo-css">...código inicial...</textarea>
        </div>
      </div>
      <div class="panel-vista">
        <span class="etiqueta">Resultado</span>
        <iframe class="vista-previa"></iframe>
      </div>
      <div class="controles-playground">
        <button type="button" class="btn-reiniciar">Restablecer código</button>
      </div>
    </div>
*/

document.addEventListener('DOMContentLoaded', function () {
  var bloques = document.querySelectorAll('.playground');
  bloques.forEach(inicializarPlayground);
});

function inicializarPlayground(contenedor) {
  var areaHtml = contenedor.querySelector('.codigo-html');
  var areaCss = contenedor.querySelector('.codigo-css');
  var vista = contenedor.querySelector('.vista-previa');
  var botonReiniciar = contenedor.querySelector('.btn-reiniciar');

  if (!areaHtml || !areaCss || !vista) {
    return;
  }

  if (document.body.hasAttribute('data-responsive-playgrounds')) {
    prepararVistaResponsiva(contenedor, vista);
  }

  var htmlInicial = areaHtml.value;
  var cssInicial = areaCss.value;

  var editorHtml = CodeMirror.fromTextArea(areaHtml, {
    mode: 'htmlmixed',
    theme: 'monokai',
    lineNumbers: false,
    lineWrapping: true,
    tabSize: 2,
    viewportMargin: Infinity,
    extraKeys: {
      'Ctrl-Space': function (cm) { mostrarSugerencias(cm, 'html'); },
      "'<'": function (cm) { return completarDespuesDe(cm, null, 'html'); },
      "'/'": function (cm) { return completarSiPrecedidoPorMenorQue(cm); },
      "' '": function (cm) { return completarSiDentroDeEtiqueta(cm); }
    }
  });

  var editorCss = CodeMirror.fromTextArea(areaCss, {
    mode: 'css',
    theme: 'monokai',
    lineNumbers: false,
    lineWrapping: true,
    tabSize: 2,
    viewportMargin: Infinity,
    extraKeys: {
      'Ctrl-Space': function (cm) { mostrarSugerencias(cm, 'css'); }
    }
  });

  editorCss.on('inputRead', function (cm, cambio) {
    if (cm.state.completionActive || !cambio.text[0]) {
      return;
    }
    if (/[a-zA-Z-]/.test(cambio.text[0])) {
      setTimeout(function () {
        mostrarSugerencias(cm, 'css');
      }, 80);
    }
  });

  var temporizador = null;

  function actualizarVista() {
    var documento =
      '<!DOCTYPE html><html><head>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<style>' +
      editorCss.getValue() +
      '</style></head><body>' +
      editorHtml.getValue() +
      '</body></html>';
    vista.srcdoc = documento;
  }

  function actualizarConRetardo() {
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(actualizarVista, 250);
  }

  editorHtml.on('change', actualizarConRetardo);
  editorCss.on('change', actualizarConRetardo);

  if (botonReiniciar) {
    botonReiniciar.addEventListener('click', function () {
      editorHtml.setValue(htmlInicial);
      editorCss.setValue(cssInicial);
      actualizarVista();
    });
  }

  actualizarVista();
}

/*
  Añade un viewport independiente a las demostraciones de responsive design.
  El marco puede ajustarse con los presets o arrastrando su esquina inferior derecha.
*/
function prepararVistaResponsiva(contenedor, vista) {
  var panel = contenedor.querySelector('.panel-vista');
  if (!panel || vista.parentElement.classList.contains('marco-vista-previa')) {
    return;
  }

  var controles = document.createElement('div');
  controles.className = 'controles-viewport';
  controles.setAttribute('role', 'group');
  controles.setAttribute('aria-label', 'Ancho de la vista previa');
  controles.innerHTML =
    '<span class="titulo-viewport">Probar viewport:</span>' +
    '<button type="button" class="btn-viewport" data-ancho="375">Móvil · 375 px</button>' +
    '<button type="button" class="btn-viewport" data-ancho="768">Tablet · 768 px</button>' +
    '<button type="button" class="btn-viewport" data-ancho="completo">Escritorio</button>' +
    '<output class="ancho-viewport" aria-live="polite"></output>';

  var marco = document.createElement('div');
  marco.className = 'marco-vista-previa';
  marco.title = 'Arrastre la esquina inferior derecha para cambiar el ancho';

  panel.insertBefore(controles, vista);
  panel.insertBefore(marco, vista);
  marco.appendChild(vista);

  var botones = controles.querySelectorAll('.btn-viewport');
  var salida = controles.querySelector('.ancho-viewport');

  function actualizarIndicador() {
    var ancho = Math.round(vista.getBoundingClientRect().width);
    var anchoCompleto = Math.round(panel.getBoundingClientRect().width);
    salida.value = ancho + ' px';
    salida.textContent = ancho + ' px';

    botones.forEach(function (boton) {
      var objetivo = boton.dataset.ancho;
      var activo = objetivo === 'completo'
        ? Math.abs(ancho - anchoCompleto) <= 2
        : Math.abs(ancho - Number(objetivo)) <= 2;
      boton.setAttribute('aria-pressed', String(activo));
    });
  }

  botones.forEach(function (boton) {
    boton.addEventListener('click', function () {
      marco.style.width = boton.dataset.ancho === 'completo'
        ? '100%'
        : boton.dataset.ancho + 'px';
      window.requestAnimationFrame(actualizarIndicador);
    });
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(actualizarIndicador).observe(marco);
  } else {
    window.addEventListener('resize', actualizarIndicador);
  }

  actualizarIndicador();
}

/*
  Funciones auxiliares de autocompletado.
  Siguen el patrón recomendado en la documentación de CodeMirror para el
  complemento show-hint: al escribir un carácter que abre un nuevo contexto
  (una etiqueta, un atributo, una propiedad CSS), se programa la aparición
  del menú de sugerencias sin bloquear la inserción normal del carácter.
*/

function mostrarSugerencias(cm, tipo) {
  var funcionSugerencia = tipo === 'html' ? CodeMirror.hint.html : CodeMirror.hint.css;
  if (!funcionSugerencia) {
    return;
  }
  cm.showHint({ hint: funcionSugerencia, completeSingle: false });
}

function completarDespuesDe(cm, condicion, tipo) {
  if (!condicion || condicion()) {
    setTimeout(function () {
      if (!cm.state.completionActive) {
        mostrarSugerencias(cm, tipo);
      }
    }, 90);
  }
  return CodeMirror.Pass;
}

function completarSiPrecedidoPorMenorQue(cm) {
  return completarDespuesDe(cm, function () {
    var cursor = cm.getCursor();
    return cm.getRange(CodeMirror.Pos(cursor.line, cursor.ch - 1), cursor) === '<';
  }, 'html');
}

function completarSiDentroDeEtiqueta(cm) {
  return completarDespuesDe(cm, function () {
    var cursor = cm.getCursor();
    if (cm.getRange(CodeMirror.Pos(cursor.line, cursor.ch - 1), cursor) !== ' ') {
      return false;
    }
    var token = cm.getTokenAt(cursor);
    if (token.type === 'string' &&
        (!/['"]/.test(token.string.charAt(token.string.length - 1)) || token.string.length === 1)) {
      return false;
    }
    var interno = CodeMirror.innerMode(cm.getMode(), token.state).state;
    return Boolean(interno.tagName);
  }, 'html');
}
