/* When the user clicks on the button,
toggle between hiding and showing the dropdown content */
function openNavNewDropdown() {
  document.getElementById("navNewDropdown").classList.toggle("show");
}

function openNavRemoveDropdown() {
  document.getElementById("navRemoveDropdown").classList.toggle("show");
}
// Close the dropdown if the user clicks outside of it
window.onclick = function(e) {
  if (!e.target.matches('.dropbtn')) {
    var navNewDropdown = document.getElementById("navNewDropdown");
    if (navNewDropdown.classList.contains('show')) {
      navNewDropdown.classList.remove('show');
    }
    var navRemoveDropdown = document.getElementById("navRemoveDropdown");
    if (navRemoveDropdown.classList.contains('show')) {
      navRemoveDropdown.classList.remove('show');
    }
  }
}

function createNewEntity(raw_entity, layer, stage) {
  let entity;
  if (raw_entity.className == "Rect") {
    let entity_values;
    try {
      entity_values = convertToEntityAttributes(raw_entity);
    } catch (err) {
      console.log(`could not create new entity. error: ${err}`);
      return;
    }
    entity = new Konva.Rect(entity_values);
  } else {
    console.log(`could not determine class for ${raw_entity}`);
    return;
  }
  setEntityEventHandling(entity, stage, layer);

  layer.add(entity);
  layer.draw();

  return entity;
}

function updateLocalEntity(raw_entity) {
  let entity_attrs = convertToEntityAttributes(raw_entity);
  let entity_id = entity_attrs.id;
  var entity = STAGE.find(`#${entity_id}`)[0];
  if (entity) {
    console.log(`updating ${entity_id}`);
    try {
      entity.attrs = entity_attrs;
      let newPosition = getSnappedPosition(entity.x(), entity.y())
      entity.x(newPosition.x);
      entity.y(newPosition.y);
    } catch (err) {
      console.log(`could not update ${entity_id}. error: ${err}`);
    }
  } else {
    console.log(`could not update ${entity_id}. could not find on stage.`);
  }

  return entity;
}

function saveEntity(entity_id, layer) {
  console.log(`saving ${entity_id}...`);
  var entity = STAGE.find(`#${entity_id}`)[0];
  var attributes = {};
  var attributesHtml = $(`#${entity_id}`).find('li');
  attributesHtml.each(function() {
    attributeName = $(this).find('.attribute')[0].innerText.replace(" ", "").replace(":", "");
    attributeValue = $(this).find('.attribute-value')[0].innerText.replace(" ", "").replace(":", "");
    if (attributeName) {
      attributes[attributeName] = attributeValue;
    }
  });
  updateLocalEntity(attributes);
  layer.draw();
  sendEntityUpdate(entity);
}

function deleteLocalEntities() {
  MAIN_LAYER.destroyChildren();
}

function deleteLocalEntitiesUpdateRemote() {
  var entities = MAIN_LAYER.getChildren().each(function(entity, n) {
    var entity_id = entity.attrs.id;
    if (entity_id) {
      socket.emit('delete entity', `${entity_id}`);
    }
  });
}

function sendEntityUpdate(entity) {
  var raw_entity = convertLocalEntityToRemote(entity);
  console.log('sending update with entity:');
  console.log(raw_entity);
  socket.emit('update entity', JSON.stringify(raw_entity));
}

function newDefaultRectangle() {
  // create in top left
  var newPosition = getSnappedPosition(STAGE_X + GRID_BLOCK_SIZE, STAGE_Y + GRID_BLOCK_SIZE)
  var rectangle = newRectangle(newPosition.x, newPosition.y, MAIN_LAYER, STAGE);
  sendEntityUpdate(rectangle);
}

function newRectangle(x, y, layer, stage, entity_id = null) {
  entity_id = entity_id || uuidv4();
  let rectangle = new Konva.Rect({
    id: entity_id,
    x: x,
    y: y,
    width: GRID_BLOCK_SIZE * 1,
    height: GRID_BLOCK_SIZE * 1,
    fill: '#fff',
    stroke: '#ddd',
    strokeWidth: 1,
    shadowColor: 'black',
    shadowBlur: 1,
    shadowOffset: { x: 1, y: 1 },
    shadowOpacity: 0.2,
    draggable: true
  });
  setEntityEventHandling(rectangle, stage, layer);
  layer.add(rectangle);
  stage.draw();

  return rectangle;
}

function setEntityEventHandling(entity, stage, layer) {
  let entity_id = entity.attrs.id;
  entity.on('dragstart', (e) => {
    SHADOW_RECT.show();
    SHADOW_RECT.moveToTop();
    entity.moveToTop();
  });
  entity.on('dragend', (e) => {
    entity.x(SHADOW_RECT.x());
    entity.y(SHADOW_RECT.y());
    layer.draw();
    stage.draw();
    SHADOW_RECT.hide();
    sendEntityUpdate(entity);
  });
  entity.on('dragmove', (e) => {
    let newPosition = getSnappedPosition(entity.x(), entity.y())
    SHADOW_RECT.x(newPosition.x);
    SHADOW_RECT.y(newPosition.y);
    layer.draw();
    stage.draw();
  });
  entity.on('click', (e) => {
    if (e.evt.button === 2) {
      if (!$(`div[aria-describedby='${entity_id}']`).length) {
        let content = `
<div id="${entity_id}" title="Basic dialog" class="ui-dialog ui-corner-all ui-widget ui-widget-content ui-front ui-dialog-buttons ui-draggable ui-resizable">
  <p>This is the default dialog ${entity_id}</p>
</div>
`;
        $("#dialogs").append(content);
        sendEntityUpdate(entity);
        $(`#${entity_id}`).dialog({
          buttons: [{
              text: "Delete",
              icon: "ui-icon-trash",
              // showText: false,
              click: function() {
                socket.emit('delete entity', `${entity_id}`);
                $(`#${entity_id}`).dialog("destroy");
              }
            },
            {
              text: "Save",
              icon: "ui-icon-disk",
              // showText: false,
              click: function() {
                saveEntity(entity_id, layer);
              }
            }
          ]
        });
      }
      $(`#${entity_id}`).dialog('open');
      $(`#${entity_id}`).dialog("option", "position", { my: "right top", at: "right-5% top+10%", of: window });
    }
  });
}

function adjustGridSize() {
  // TODO take user input
  // http://api.jqueryui.com/dialog/#option-modal
  var modalUUID = uuidv4();
  let content = `
<div id="${modalUUID}" title="Change Grid Size" class="ui-dialog ui-corner-all ui-widget ui-widget-content ui-front ui-dialog-buttons">
<p>Current grid size: ${GRID_BLOCK_SIZE}</p>
<p>Enter new grid size: <input class='new-grid-size ui-widget ui-widget-content ui-corner-all'></input></p>
</div>
`;
  $("#dialogs").append(content);

  $(`#${modalUUID}`).dialog({
    modal: true,
    draggable: false,
    buttons: [{
      text: "Save",
      icon: "ui-icon-disk",
      click: function() {
        var newSize = Math.abs(
          getNumber($(`#${modalUUID}`).find('.new-grid-size').val())
        );

        if (newSize) {
          GRID_BLOCK_SIZE = newSize;
        }

        // snap to new positions
        deleteLocalEntities();
        recomputeGlobals();
        recreateGridLayer();
        createLocalEntitiesFromRemote();

        $(`#${modalUUID}`).dialog('close');
      }
    }]
  });
}

// https://stackoverflow.com/a/2117523
function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

function getNumber(value) {
  if (isNaN(value)) throw `${value} not a number`;
  return Number(value);
}

function convertToEntityAttributes(raw_entity) {
  if (raw_entity.attrs) {
    given_attrs = raw_entity.attrs
  } else {
    given_attrs = raw_entity
  }

  var entity_attrs = JSON.parse(JSON.stringify(raw_entity));

  if (raw_entity.className == "Rect") {
    for (const key of Object.keys(given_attrs)) {
      if (key == "draggable") {
        entity_attrs.draggable = (given_attrs.draggable === true || given_attrs.draggable == 'true');
      } else if (key == "x") {
        entity_attrs.x = getNumber(given_attrs.x) * GRID_BLOCK_SIZE;
      } else if (key == "y") {
        entity_attrs.y = getNumber(given_attrs.y) * GRID_BLOCK_SIZE;
      } else if (key == "height") {
        entity_attrs.height = getNumber(given_attrs.height) * GRID_BLOCK_SIZE;
      } else if (key == "width") {
        entity_attrs.width = getNumber(given_attrs.width) * GRID_BLOCK_SIZE;
      } else if (key == "shadowBlur") {
        entity_attrs.shadowBlur = getNumber(given_attrs.shadowBlur);
      } else if (key == "shadowOffsetX") {
        entity_attrs.shadowOffsetX = getNumber(given_attrs.shadowOffsetX);
      } else if (key == "shadowOffsetY") {
        entity_attrs.shadowOffsetY = getNumber(given_attrs.shadowOffsetY);
      } else if (key == "shadowOpacity") {
        entity_attrs.shadowOpacity = getNumber(given_attrs.shadowOpacity);
      } else if (key == "strokeWidth") {
        entity_attrs.strokeWidth = getNumber(given_attrs.strokeWidth);
      } else if (key == "offsetX") {
        entity_attrs.offsetX = getNumber(given_attrs.offsetX);
      } else if (key == "offsetY") {
        entity_attrs.offsetY = getNumber(given_attrs.offsetY);
      } else if (key == "rotation") {
        entity_attrs.rotation = getNumber(given_attrs.rotation);
      } else if (key == "scaleX") {
        entity_attrs.scaleX = getNumber(given_attrs.scaleX);
      } else if (key == "scaleY") {
        entity_attrs.scaleY = getNumber(given_attrs.scaleY);
      } else if (key == "skewX") {
        entity_attrs.skewX = getNumber(given_attrs.skewX);
      } else if (key == "skewY") {
        entity_attrs.skewY = getNumber(given_attrs.skewY);
      } else {
        // unknown values default to string
        entity_attrs[key] = given_attrs[key].toString()
      }
    }
  }
  return entity_attrs
}

function mod(n, m) {
  // js modulo operator (%) is weird with negative numbers
  // https://stackoverflow.com/a/17323608
  return ((n % m) + m) % m;
}

function createGridLayer() {
  var gridLayer = new Konva.Layer();
  for (var i = START_X; i < STAGE_MAX_X; i += GRID_BLOCK_SIZE) {
    gridLayer.add(new Konva.Line({
      points: [i, STAGE_Y, i, STAGE_MAX_Y],
      stroke: '#ddd',
      strokeWidth: 1,
      selectable: false
    }));
  }
  for (var j = START_Y; j < STAGE_MAX_Y; j += GRID_BLOCK_SIZE) {
    gridLayer.add(new Konva.Line({
      points: [STAGE_X, j, STAGE_MAX_X, j],
      stroke: '#ddd',
      strokeWidth: 1,
      selectable: false
    }));
  }
  STAGE.add(gridLayer);
  gridLayer.moveToBottom();
  return gridLayer;
}

function getSnappedPosition(x, y) {
  var xRem = mod(x, GRID_BLOCK_SIZE);
  var yRem = mod(y, GRID_BLOCK_SIZE);
  if (xRem <= GRID_BLOCK_SIZE / 2) {
    var newX = x - xRem;
  } else {
    var newX = x + (GRID_BLOCK_SIZE - xRem);
  }
  if (yRem <= GRID_BLOCK_SIZE / 2) {
    var newY = y - yRem;
  } else {
    var newY = y + (GRID_BLOCK_SIZE - yRem);
  }
  return { "x": newX, "y": newY }
}

function convertLocalEntityToRemote(entity) {
  // idk why but one JSON.parse resulted in a string... not a full JSON object
  var raw_entity = JSON.parse(JSON.parse(JSON.stringify(entity)));

  // store the location and size in terms of the grid size on he server
  var grid_location_x = (raw_entity.attrs.x / GRID_BLOCK_SIZE) || 0;
  var grid_location_y = (raw_entity.attrs.y / GRID_BLOCK_SIZE) || 0;
  var grid_height = (raw_entity.attrs.height / GRID_BLOCK_SIZE) || 0;
  var grid_width = (raw_entity.attrs.width / GRID_BLOCK_SIZE) || 0;

  raw_entity.attrs.x = grid_location_x;
  raw_entity.attrs.y = grid_location_y;
  raw_entity.attrs.height = grid_height;
  raw_entity.attrs.width = grid_width;

  return raw_entity;
}

function createLocalEntitiesFromRemote() {
  $.getJSON("/api/entities", function(response) {
    for (var i = 0; i < response.entities.length; i++) {
      createNewEntity(response.entities[i], MAIN_LAYER, STAGE);
    }
  });
}

function recreateGridLayer() {
  var newGridLayer = createGridLayer(STAGE);
  GRID_LAYER.destroy();
  GRID_LAYER = newGridLayer;
}

function recomputeGlobals() {
  WIDTH = $(window).width();
  HEIGHT = $(window).height();
  STAGE_X = -STAGE.attrs.x || 0;
  STAGE_Y = -STAGE.attrs.y || 0;
  STAGE_MAX_X = STAGE_X + WIDTH;
  STAGE_MAX_Y = STAGE_Y + HEIGHT;
  START_X = STAGE_X + (GRID_BLOCK_SIZE - mod(STAGE_X, GRID_BLOCK_SIZE));
  START_Y = STAGE_Y + (GRID_BLOCK_SIZE - mod(STAGE_Y, GRID_BLOCK_SIZE));
}

var WIDTH = $(window).width();
var HEIGHT = $(window).height();
var GRID_BLOCK_SIZE = 50;


var ws_scheme = "wss://"
// var ws_scheme = "https://"

var socket = io.connect(ws_scheme + document.domain + ':' + location.port + '/test');
socket.on('deleted entity', function(data) {
  let entity_id = data;
  var entity = STAGE.find(`#${entity_id}`)[0];
  if (entity) {
    console.log(`deleting ${entity_id}`);
    entity.destroy();
    STAGE.draw();
  }
});
socket.on('updated entity', function(data) {
  var entity = updateLocalEntity(data);

  // if didn't get updated, it doesn't exist
  if (!entity) {
    entity = createNewEntity(data, MAIN_LAYER, STAGE);
  }
  var entity_id = entity.attrs.id;
  var keys = Object.keys(data);
  ul = $(`<ul id=${entity_id}_dialog_attrs style="list-style-type: none;">`);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    ul.append(`<li><span class='attribute-delete ui-icon ui-icon-circlesmall-minus' onclick='$(this).closest(\"li\").remove(); saveEntity(\"${entity_id}\", MAIN_LAYER);'></span><code class='attribute'><em>` + key + "</em></code><em class='attribute-separator'>:</em><code class='attribute-value' contenteditable='true'>" + data[key] + "</code></li>");
  }
  ul.append("<li><code class='attribute new-attribute' contenteditable='true'></code><em class='attribute-separator'>:</em><code class='attribute-value new-attribute-value' contenteditable='true'></code></li>");
  $(`#${entity_id}`).html(ul);
  // FIXME: for some reason, redrawing the layer does not move the
  //        position of the shape on other clients if it updates.
  //        Locally, shape moves fine. It updates find on clients.
  //        In fact, color changes happen fine on all clients,
  //        but the shape won't move. Strangely, if either x OR y is 0,
  //        the shape DOES move on all clients. I give up, I have no
  //        idea what is going on.
  //
  // Solution: Hard reset. Destroy and recreate on update :shrug:
  var raw_entity = convertLocalEntityToRemote(entity);
  entity.destroy();
  createNewEntity(raw_entity, MAIN_LAYER, STAGE);
});
var SHADOW_RECT = new Konva.Rect({
  x: 0,
  y: 0,
  width: GRID_BLOCK_SIZE * 1,
  height: GRID_BLOCK_SIZE * 1,
  fill: '#888888',
  opacity: 0.3,
  stroke: '#999999',
  strokeWidth: 3
});
var STAGE = new Konva.Stage({
  container: 'container',
  width: WIDTH,
  height: HEIGHT,
  draggable: true
});
STAGE.on('dragend', (e) => {
  recomputeGlobals();
  var newGridLayer = createGridLayer(STAGE);
  GRID_LAYER.destroy();
  GRID_LAYER = newGridLayer;
});
recomputeGlobals();
var MAP_LAYER = new Konva.Layer();
STAGE.add(MAP_LAYER);
var GRID_LAYER = createGridLayer(STAGE);
var MAIN_LAYER = new Konva.Layer();
SHADOW_RECT.hide();
MAIN_LAYER.add(SHADOW_RECT);
STAGE.add(MAIN_LAYER);
// do not show context menu on right click
STAGE.on('contentContextmenu', (e) => {
  e.evt.preventDefault();
});
createLocalEntitiesFromRemote()
$(window).resize(function() {
  recomputeGlobals();
  STAGE.width(WIDTH);
  STAGE.height(HEIGHT);
  STAGE.draw();
  recreateGridLayer()
});
Konva.dragDistance = 3;