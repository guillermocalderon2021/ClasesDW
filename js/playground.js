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

  if (document.body.hasAttribute('data-responsive-playgrounds') ||
      contenedor.dataset.redimensionable === 'true') {
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
    var librerias = (contenedor.dataset.libs || '').split(/\s+/);
    var cabeceraExterna = '';
    var scriptsExternos = '';

    if (librerias.indexOf('bootstrap') !== -1) {
      cabeceraExterna +=
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" ' +
        'integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB" ' +
        'crossorigin="anonymous">';
      scriptsExternos +=
        '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js" ' +
        'integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI" ' +
        'crossorigin="anonymous"><\/script>';
    }

    var documento =
      '<!DOCTYPE html><html><head>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      cabeceraExterna +
      '<style>' +
      editorCss.getValue() +
      '</style></head><body>' +
      editorHtml.getValue() +
      scriptsExternos +
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

  var anchoMaximo = Number(
    contenedor.dataset.anchoMaximo ||
    document.body.dataset.anchoMaximoPlaygrounds
  );
  var presets = obtenerPresets(contenedor.dataset.viewports);

  if (anchoMaximo > 0 && !presets.some(function (preset) {
    return Number(preset.ancho) === anchoMaximo;
  })) {
    presets.push({
      ancho: String(anchoMaximo),
      etiqueta: 'Máximo · ' + anchoMaximo + ' px'
    });
  }

  var botonesHtml = presets.map(function (preset) {
    return '<button type="button" class="btn-viewport" data-ancho="' +
      preset.ancho + '">' + preset.etiqueta + '</button>';
  }).join('');

  var controles = document.createElement('div');
  controles.className = 'controles-viewport';
  controles.setAttribute('role', 'group');
  controles.setAttribute('aria-label', 'Ancho de la vista previa');
  controles.innerHTML =
    '<span class="titulo-viewport">Probar viewport:</span>' +
    botonesHtml +
    '<button type="button" class="btn-viewport" data-ancho="completo">Ajustar al panel</button>' +
    '<output class="ancho-viewport" aria-live="polite"></output>';

  var zona = document.createElement('div');
  zona.className = 'zona-viewport';

  var marco = document.createElement('div');
  marco.className = 'marco-vista-previa';
  marco.title = 'Arrastre la esquina inferior derecha para cambiar el ancho';
  if (anchoMaximo > 0) {
    marco.style.maxWidth = anchoMaximo + 'px';
  }

  panel.insertBefore(controles, vista);
  panel.insertBefore(zona, vista);
  zona.appendChild(marco);
  marco.appendChild(vista);

  var botones = controles.querySelectorAll('.btn-viewport');
  var salida = controles.querySelector('.ancho-viewport');

  function actualizarIndicador() {
    var ancho = Math.round(marco.offsetWidth);
    var anchoDisponible = Math.round(zona.clientWidth);
    var escala = ancho > 0 ? Math.min(1, anchoDisponible / ancho) : 1;
    var textoEscala = escala < 0.999
      ? ' · vista al ' + Math.round(escala * 100) + '%'
      : '';

    marco.style.transform = escala < 0.999
      ? 'scale(' + escala + ')'
      : 'none';
    zona.style.height = Math.ceil(marco.offsetHeight * escala) + 'px';
    salida.value = ancho + ' px' + textoEscala;
    salida.textContent = ancho + ' px' + textoEscala;

    botones.forEach(function (boton) {
      var objetivo = boton.dataset.ancho;
      var activo = objetivo === 'completo'
        ? Math.abs(ancho - anchoDisponible) <= 2
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

  var anchoInicial = contenedor.dataset.anchoInicial;
  if (anchoInicial) {
    marco.style.width = anchoInicial + 'px';
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(actualizarIndicador).observe(marco);
    new ResizeObserver(actualizarIndicador).observe(zona);
  } else {
    window.addEventListener('resize', actualizarIndicador);
  }

  actualizarIndicador();
}

function obtenerPresets(configuracion) {
  if (!configuracion) {
    return [
      { ancho: '375', etiqueta: 'Móvil · 375 px' },
      { ancho: '768', etiqueta: 'Tablet · 768 px' }
    ];
  }

  return configuracion.split(',').map(function (elemento) {
    var partes = elemento.trim().split(':');
    var ancho = partes.shift();
    var nombre = partes.join(':');
    return {
      ancho: ancho,
      etiqueta: nombre ? nombre + ' · ' + ancho + ' px' : ancho + ' px'
    };
  }).filter(function (preset) {
    return /^\d+$/.test(preset.ancho);
  });
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
