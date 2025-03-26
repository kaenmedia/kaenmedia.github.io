// Глобальные переменные для карты
const osmLayer = new ol.layer.Tile({ source: new ol.source.OSM() });
const regionsSource = new ol.source.Vector();
const pinsSource = new ol.source.Vector();
let map, regionsLayer, pinsLayer;
let drawInteraction = null;
let isDrawingMode = false;
let pointPlacementMode = false;
let activePointFeature = null;

// DOM-элементы для частого использования
const elements = {
  datasetList: document.getElementById('dataset-list'),
  regionList: document.getElementById('region-list'),
  pointList: document.getElementById('point-list'),
  datasetModal: document.getElementById('dataset-modal'),
  regionModal: document.getElementById('region-modal'),
  pointModal: document.getElementById('point-modal'),
  exportCode: document.getElementById('export-code'),
  regionDatasetSelect: document.getElementById('region-dataset-select'),
  pointDatasetSelect: document.getElementById('point-dataset-select'),
  pointRegionSelect: document.getElementById('point-region-select'),
  modalPointRegionSelect: document.getElementById('point-region-select-modal'),
};

// Инициализация карты
function initMap() {
  // Настройка слоев
  osmLayer.setZIndex(0);
  
  regionsLayer = new ol.layer.Vector({
    source: regionsSource,
    style: function(feature) {
      // Проверяем, есть ли прямые свойства или нужно искать их в properties
      const fillColor = feature.get('fillColor') || 
                       (feature.get('properties') && feature.get('properties').fillColor) || 
                       'rgba(0,0,0,0.1)';
      const strokeColor = feature.get('strokeColor') || 
                         (feature.get('properties') && feature.get('properties').strokeColor) || 
                         '#333';
      
      return new ol.style.Style({
        fill: new ol.style.Fill({
          color: fillColor
        }),
        stroke: new ol.style.Stroke({
          color: strokeColor,
          width: 2
        })
      });
    }
  });
  regionsLayer.setZIndex(1);
  
  pinsLayer = new ol.layer.Vector({ 
    source: pinsSource,
    zIndex: 9999
  });
  pinsLayer.setZIndex(2);
  
  // Создание карты
  map = new ol.Map({
    target: 'map',
    layers: [osmLayer, regionsLayer, pinsLayer],
    view: new ol.View({
      center: ol.proj.fromLonLat([49.3, 55.5]), // Примерно центр Татарстана
      zoom: 7
    })
  });
  
  // Обработчик клика по карте
  map.on('singleclick', function(evt) {
    if (pointPlacementMode) {
      const coords = ol.proj.toLonLat(evt.coordinate);
      // Округляем координаты до сотых для более удобного отображения
      const roundedLon = parseFloat(coords[0].toFixed(2));
      const roundedLat = parseFloat(coords[1].toFixed(2));
      
      document.getElementById('point-lon').value = roundedLon;
      document.getElementById('point-lat').value = roundedLat;
      
      if (activePointFeature) {
        pinsSource.removeFeature(activePointFeature);
      }
      
      // Создаем временный маркер
      activePointFeature = new ol.Feature({
        geometry: new ol.geom.Point(evt.coordinate)
      });
      
      activePointFeature.setStyle(new ol.style.Style({
        image: new ol.style.Circle({
          radius: 7,
          fill: new ol.style.Fill({
            color: '#ff0000'
          }),
          stroke: new ol.style.Stroke({
            color: '#ffffff',
            width: 2
          })
        })
      }));
      
      pinsSource.addFeature(activePointFeature);
      pointPlacementMode = false;
      document.querySelector('.place-on-map-btn').textContent = 'Указать на карте';
      
      // Восстанавливаем видимость модального окна
      restoreModalVisibility('point-modal');
      
      return;
    }
    
    // Если не в режиме размещения, показываем информацию при клике
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(f) {
      return f;
    });
    
    if (feature) {
      const geomType = feature.getGeometry().getType();
      if (geomType === 'Point') {
        showPinPopup(feature);
      }
    }
  });
}

// Инициализация UI интерфейса
function initUI() {
  // Табы
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', function() {
      // Убираем активный класс у всех кнопок и панелей
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
      
      // Добавляем активный класс текущей кнопке и соответствующей панели
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(`${tabId}-panel`).classList.add('active');
    });
  });
  
  // Закрытие модальных окон - обработчик для крестика (X)
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = this.closest('.modal');
      hideModal(modal.id);
      
      // Если закрываем окно региона и есть активное взаимодействие рисования, удаляем его
      if (modal.id === 'region-modal' && drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
        isDrawingMode = false;
        document.querySelector('.draw-region-btn').textContent = 'Нарисовать на карте';
      }
      
      // Если закрываем окно точки и активен режим размещения точки, отключаем его
      if (modal.id === 'point-modal' && pointPlacementMode) {
        pointPlacementMode = false;
        document.querySelector('.place-on-map-btn').textContent = 'Указать на карте';
      }
    });
  });
  
  // Обработчики для элементов закрытия с атрибутом data-modal
  document.querySelectorAll('.close[data-modal], .btn-cancel[data-modal], .cancel-btn[data-modal]').forEach(btn => {
    btn.addEventListener('click', function() {
      const modalId = this.getAttribute('data-modal');
      if (modalId) {
        hideModal(modalId);
      }
    });
  });
  
  // Обработчики для кнопок отмены без атрибута data-modal
  document.querySelectorAll('.cancel-btn:not([data-modal])').forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = this.closest('.modal');
      if (modal) {
        hideModal(modal.id);
        
        // Если закрываем окно региона и есть активное взаимодействие рисования, удаляем его
        if (modal.id === 'region-modal' && drawInteraction) {
          map.removeInteraction(drawInteraction);
          drawInteraction = null;
          isDrawingMode = false;
          document.querySelector('.draw-region-btn').textContent = 'Нарисовать на карте';
        }
        
        // Если закрываем окно точки и активен режим размещения точки, отключаем его
        if (modal.id === 'point-modal' && pointPlacementMode) {
          pointPlacementMode = false;
          document.querySelector('.place-on-map-btn').textContent = 'Указать на карте';
        }
      }
    });
  });
  
  // Кнопка добавления датасета
  document.querySelector('.add-dataset-btn').addEventListener('click', function() {
    showModal('dataset-modal');
  });
  
  // Кнопка добавления региона
  document.querySelector('.add-region-btn').addEventListener('click', function() {
    populateDatasetSelects();
    showModal('region-modal');
    
    // Очищаем форму
    document.getElementById('region-form').reset();
    document.getElementById('region-fill-color').value = '#ffa500';
    document.getElementById('region-fill-opacity').value = 0.3;
    document.getElementById('region-stroke-color').value = '#ff6400';
    
    // Очищаем скрытое поле со старым именем региона, если оно существует
    if (document.getElementById('region-old-name')) {
      document.getElementById('region-old-name').value = '';
    }
    
    // Прямая установка стилей предпросмотра
    const preview = document.getElementById('region-color-preview');
    if (preview) {
      const fillRgb = hexToRgb(document.getElementById('region-fill-color').value);
      const fillOpacity = document.getElementById('region-fill-opacity').value;
      const strokeColor = document.getElementById('region-stroke-color').value;
      
      preview.style.width = '30px';
      preview.style.height = '30px';
      preview.style.borderRadius = '4px';
      preview.style.display = 'inline-block';
      preview.style.backgroundColor = `rgba(${fillRgb}, ${fillOpacity})`;
      preview.style.border = `1px solid ${strokeColor}`;
    }
    
    // Обновляем превью цвета
    updateColorPreview();
    
    // Добавляем обработчики событий для полей цвета
    document.getElementById('region-fill-color').addEventListener('input', updateColorPreview);
    document.getElementById('region-fill-opacity').addEventListener('input', updateColorPreview);
    document.getElementById('region-stroke-color').addEventListener('input', updateColorPreview);
    
    // Очищаем все координаты кроме первой пары
    const container = document.getElementById('coordinates-container');
    const pairs = container.querySelectorAll('.coordinate-pair');
    for (let i = 1; i < pairs.length; i++) {
      container.removeChild(pairs[i]);
    }
    const inputs = pairs[0].querySelectorAll('input');
    inputs.forEach(input => input.value = '');
  });
  
  // Кнопка добавления точки
  document.querySelector('.add-point-btn').addEventListener('click', function() {
    // Показываем модальное окно
    showModal('point-modal');
    
    // Очищаем форму
    document.getElementById('point-form').reset();
    document.getElementById('photo-preview').innerHTML = '';
    
    // Убираем временный маркер, если он есть
    if (activePointFeature) {
      pinsSource.removeFeature(activePointFeature);
      activePointFeature = null;
    }
    
    // Очищаем скрытое поле индекса или удаляем его, если оно существует
    if (document.getElementById('point-index')) {
      document.getElementById('point-index').value = -1;
    }
    
    // Очищаем скрытые поля оригинального датасета и региона
    if (document.getElementById('original-dataset')) {
      document.getElementById('original-dataset').value = '';
    }
    
    if (document.getElementById('original-region')) {
      document.getElementById('original-region').value = '';
    }
    
    // Получаем текущий датасет из интерфейса вкладки "Точки"
    const currentDataset = document.getElementById('point-dataset-select').value || appData.currentDataset;
    
    // Заполняем селект датасетов в модальном окне
    const modalDatasetSelect = document.getElementById('point-dataset');
    modalDatasetSelect.innerHTML = '';
    
    // Заполняем датасеты
    Object.keys(appData.datasets).forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = appData.datasets[key].name;
      if (key === currentDataset) {
        option.selected = true;
      }
      modalDatasetSelect.appendChild(option);
    });
    
    // Заполняем регионы для выбранного датасета
    console.log('Инициализация списка регионов для выбранного датасета:', currentDataset);
    populateRegionSelect(currentDataset, 'point-region-select-modal');
    
    // Добавляем обработчик события изменения датасета
    modalDatasetSelect.onchange = function() {
      const selectedDataset = this.value;
      console.log('Изменение датасета в модальном окне точки (добавление):', selectedDataset);
      populateRegionSelect(selectedDataset, 'point-region-select-modal');
    };
  });
  
  // Форма региона
  document.getElementById('region-form').addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('Отправка формы региона');
    
    const datasetKey = document.getElementById('region-dataset').value;
    const name = document.getElementById('region-name').value;
    const fillColor = document.getElementById('region-fill-color').value;
    const fillOpacity = document.getElementById('region-fill-opacity').value;
    const strokeColor = document.getElementById('region-stroke-color').value;
    
    console.log('Данные формы:', {
      datasetKey,
      name,
      fillColor,
      fillOpacity,
      strokeColor
    });
    
    // Проверяем, редактируем ли мы существующий регион
    const oldNameField = document.getElementById('region-old-name');
    const isEditing = oldNameField && oldNameField.value !== '';
    const oldName = isEditing ? oldNameField.value : null;
    
    // Получаем тип геометрии, если это редактирование существующего региона
    const geometryTypeField = document.getElementById('region-geometry-type');
    const geometryType = geometryTypeField ? geometryTypeField.value : 'Polygon';
    
    // Создаем объект региона
    let regionData;
    
    if (geometryType === 'MultiPolygon' && isEditing) {
      // Для MultiPolygon берем оригинальные координаты из скрытого поля
      const originalCoordinatesField = document.getElementById('original-coordinates');
      if (!originalCoordinatesField || !originalCoordinatesField.value) {
        alert('Ошибка: не найдены координаты для MultiPolygon');
        return;
      }
      
      try {
        const coordinates = JSON.parse(originalCoordinatesField.value);
        
        regionData = {
          type: 'Feature',
          geometry: {
            type: 'MultiPolygon',
            coordinates: coordinates
          },
          properties: {
            name: name,
            fillColor: `rgba(${hexToRgb(fillColor)}, ${fillOpacity})`,
            strokeColor: strokeColor
          }
        };
      } catch (error) {
        console.error('Ошибка при разборе JSON координат:', error);
        alert('Ошибка при обработке координат: ' + error.message);
        return;
      }
    } else {
      // Для обычного полигона собираем координаты из формы
      const coordinates = [];
      document.querySelectorAll('.coordinate-pair').forEach(pair => {
        const lon = parseFloat(pair.querySelector('.lon-input').value);
        const lat = parseFloat(pair.querySelector('.lat-input').value);
        
        if (!isNaN(lon) && !isNaN(lat)) {
          coordinates.push([lon, lat]);
        }
      });
      
      // Проверки
      if (coordinates.length < 3) {
        alert('Необходимо указать минимум 3 точки для создания полигона');
        return;
      }
      
      // Добавляем первую точку в конец, чтобы замкнуть полигон
      if (coordinates[0][0] !== coordinates[coordinates.length-1][0] || 
          coordinates[0][1] !== coordinates[coordinates.length-1][1]) {
        coordinates.push(coordinates[0]);
      }
      
      regionData = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        },
        properties: {
          name: name,
          fillColor: `rgba(${hexToRgb(fillColor)}, ${fillOpacity})`,
          strokeColor: strokeColor
        }
      };
    }
    
    console.log('Объект региона:', regionData);
    
    try {
      // В зависимости от режима вызываем соответствующую функцию
      if (isEditing) {
        // Обновляем существующий регион
        updateRegion(datasetKey, oldName, regionData);
      } else {
        // Добавляем новый регион
        addRegion(datasetKey, regionData);
      }
      
      // Обновляем интерфейс
      updateRegionList();
      populateDatasetSelects();
      
      // Если есть взаимодействие рисования, удаляем его
      if (drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
      }
      
      // Обновляем слой регионов
      loadPolygonsForDataset(datasetKey);
      
      // Закрываем модальное окно
      hideModal('region-modal');
      
      // Сбрасываем форму
      this.reset();
      
      console.log('Регион успешно добавлен/обновлен');
    } catch (error) {
      console.error('Ошибка при добавлении/обновлении региона:', error);
      alert(error.message);
    }
  });
  
  // Форма точки
  document.getElementById('point-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const datasetKey = document.getElementById('point-dataset').value;
    const regionName = document.getElementById('point-region-select-modal').value;
    const name = document.getElementById('point-name').value;
    const city = document.getElementById('point-city').value;
    const quote = document.getElementById('point-quote').value;
    const photo = document.getElementById('point-photo').value;
    const video = document.getElementById('point-video').value;
    const lon = parseFloat(document.getElementById('point-lon').value);
    const lat = parseFloat(document.getElementById('point-lat').value);
    
    // Получаем индекс точки из скрытого поля
    const pointIndexElement = document.getElementById('point-index');
    console.log('Элемент point-index:', pointIndexElement);
    const pointIndex = pointIndexElement ? parseInt(pointIndexElement.value) : -1;
    console.log('Значение point-index:', pointIndexElement ? pointIndexElement.value : 'не найдено');
    console.log('Полученный pointIndex:', pointIndex);
    
    // Получаем оригинальный датасет и регион (если это редактирование)
    const originalDatasetElement = document.getElementById('original-dataset');
    const originalRegionElement = document.getElementById('original-region');
    
    const originalDataset = originalDatasetElement ? originalDatasetElement.value : null;
    const originalRegion = originalRegionElement ? originalRegionElement.value : null;
    
    console.log('Отправка формы точки:', {
      datasetKey,
      regionName,
      name,
      pointIndex,
      coords: [lon, lat],
      originalDataset,
      originalRegion
    });
    
    // Проверки
    if (isNaN(lon) || isNaN(lat)) {
      alert('Необходимо указать корректные координаты');
      return;
    }
    
    // Создаем объект точки
    const pointData = {
      name: name,
      city: city || '',
      quote: quote || '',
      photo: photo,
      video: video || '',
      coords: [lon, lat]
    };
    
    try {
      // Если это редактирование существующей точки
      if (pointIndex >= 0) {
        console.log('Обновление существующей точки с индексом:', pointIndex);
        
        // Проверяем, изменился ли датасет или регион
        if (originalDataset && originalRegion && 
            (originalDataset !== datasetKey || originalRegion !== regionName)) {
          console.log('Точка перемещена из', originalDataset, originalRegion, 'в', datasetKey, regionName);
          
          // Добавляем точку в новый датасет/регион
          addPin(datasetKey, regionName, pointData);
          
          // Удаляем точку из старого датасета/региона
          deletePin(originalDataset, originalRegion, pointIndex);
        } else {
          // Если датасет и регион не изменились, используем updatePin
          updatePin(datasetKey, regionName, pointIndex, pointData);
        }
      } else {
        // Добавляем новую точку
        console.log('Добавление новой точки');
        addPin(datasetKey, regionName, pointData);
      }
      
      updatePointList();
      hideModal('point-modal');
      
      // Убираем временный маркер
      if (activePointFeature) {
        pinsSource.removeFeature(activePointFeature);
        activePointFeature = null;
      }
      
      // Если мы сейчас просматриваем этот регион, обновляем точки
      if (appData.currentDataset === datasetKey) {
        showPinsForRegion(regionName);
      }
      
      this.reset();
    } catch (error) {
      console.error('Ошибка при сохранении точки:', error);
      alert('Ошибка при сохранении точки: ' + error.message);
    }
  });
  
  // Кнопка добавления координаты
  document.querySelector('.add-coord-btn').addEventListener('click', function() {
    const container = document.getElementById('coordinates-container');
    const newPair = document.createElement('div');
    newPair.className = 'coordinate-pair';
    newPair.innerHTML = `
      <input type="number" step="0.0001" placeholder="Долгота" class="lon-input" required>
      <input type="number" step="0.0001" placeholder="Широта" class="lat-input" required>
      <button type="button" class="remove-coord-btn">-</button>
    `;
    
    container.appendChild(newPair);
    
    // Обработчик на новую кнопку удаления
    newPair.querySelector('.remove-coord-btn').addEventListener('click', function() {
      container.removeChild(newPair);
    });
  });
  
  // Делегирование события для всех кнопок удаления координат
  document.getElementById('coordinates-container').addEventListener('click', function(e) {
    if (e.target.classList.contains('remove-coord-btn')) {
      const pairs = document.querySelectorAll('.coordinate-pair');
      // Проверяем, что это не последняя пара координат
      if (pairs.length > 1) {
        e.target.closest('.coordinate-pair').remove();
      } else {
        alert('Должна остаться хотя бы одна пара координат');
      }
    }
  });
  
  // Кнопка рисования региона на карте
  document.querySelector('.draw-region-btn').addEventListener('click', function() {
    toggleDrawingMode();
  });
  
  // Кнопка указания точки на карте
  document.querySelector('.place-on-map-btn').addEventListener('click', function() {
    pointPlacementMode = !pointPlacementMode;
    this.textContent = pointPlacementMode ? 'Отменить' : 'Указать на карте';
    
    // Делаем модальное окно прозрачным при включении режима размещения точки
    if (pointPlacementMode) {
      temporaryHideModal('point-modal');
    } else {
      // Восстанавливаем видимость при отмене
      restoreModalVisibility('point-modal');
    }
  });
  
  // Предпросмотр фото
  document.getElementById('point-photo').addEventListener('change', function() {
    const photoUrl = this.value;
    const previewContainer = document.getElementById('photo-preview');
    
    if (photoUrl) {
      previewContainer.innerHTML = `<img src="${photoUrl}" alt="Preview" style="max-width:100%">`;
    } else {
      previewContainer.innerHTML = '';
    }
  });
  
  // Изменение датасета в панели регионов
  document.getElementById('region-dataset-select').addEventListener('change', function() {
    const datasetKey = this.value;
    console.log('Выбран датасет во вкладке регионов:', datasetKey);
    
    // Обновляем текущий выбранный датасет в глобальных данных
    appData.currentDataset = datasetKey;
    
    // Синхронизируем выбор датасета во вкладке точек
    const pointDatasetSelect = document.getElementById('point-dataset-select');
    if (pointDatasetSelect && pointDatasetSelect.value !== datasetKey) {
      pointDatasetSelect.value = datasetKey;
      console.log('Синхронизирован датасет в селекте точек:', datasetKey);
      
      // Обновляем список регионов в точках
      populateRegionSelect(datasetKey, 'point-region-select');
      updatePointList();
    }
    
    // Обновляем список регионов
    updateRegionList();
    
    // Обновляем слой регионов на карте
    loadPolygonsForDataset(datasetKey);
    pinsSource.clear();
  });
  
  // Изменение датасета в панели точек
  document.getElementById('point-dataset-select').addEventListener('change', function() {
    const datasetKey = this.value;
    console.log('Выбран датасет во вкладке точек:', datasetKey);
    
    // Проверяем, что датасет действительно существует
    if (!appData.datasets[datasetKey]) {
      console.error(`Датасет "${datasetKey}" не найден!`);
      return;
    }
    
    // Обновляем текущий выбранный датасет в глобальных данных
    appData.currentDataset = datasetKey;
    
    // Синхронизируем выбор датасета во вкладке регионов
    const regionDatasetSelect = document.getElementById('region-dataset-select');
    if (regionDatasetSelect && regionDatasetSelect.value !== datasetKey) {
      regionDatasetSelect.value = datasetKey;
      console.log('Синхронизирован датасет в селекте регионов:', datasetKey);
      
      // Обновляем список регионов
      updateRegionList();
    }
    
    // Обновляем список регионов для точек
    const regions = getPolygons(datasetKey);
    console.log('Найдено регионов для датасета:', regions.length, regions);
    
    // Обновление списка регионов соответствующих датасету
    populateRegionSelect(datasetKey, 'point-region-select');
    
    // Обновление списка точек
    updatePointList();
    
    // Обновляем слой регионов на карте
    loadPolygonsForDataset(datasetKey);
    pinsSource.clear();
  });
  
  // Изменение региона в панели точек
  document.getElementById('point-region-select').addEventListener('change', function() {
    updatePointList();
  });
  
  // Кнопка экспорта HTML
  document.querySelector('.export-btn').addEventListener('click', function() {
    // Получаем элемент напрямую на случай, если в elements он отсутствует
    const exportCodeElement = document.getElementById('export-code');
    if (exportCodeElement) {
      exportCodeElement.value = generateHTML();
    } else {
      console.error('Элемент #export-code не найден на странице');
      alert('Ошибка при генерации HTML: элемент для вывода не найден');
    }
  });
  
  // Кнопка копирования
  document.querySelector('.copy-btn').addEventListener('click', function() {
    const exportCodeElement = document.getElementById('export-code');
    if (exportCodeElement) {
      exportCodeElement.select();
      document.execCommand('copy');
      alert('Код скопирован в буфер обмена');
    } else {
      console.error('Элемент #export-code не найден на странице');
      alert('Ошибка: элемент для копирования не найден');
    }
  });
  
  // Добавляем кнопки экспорта/импорта данных
  const exportPanel = document.getElementById('export-panel');
  const dataExportDiv = document.createElement('div');
  dataExportDiv.innerHTML = `
    <h3>Экспорт/Импорт данных</h3>
    <div class="export-controls">
      <button class="btn export-data-btn">Экспорт JSON</button>
      <button class="btn import-data-btn">Импорт JSON</button>
      <input type="file" id="import-file" style="display:none" accept=".json">
    </div>
  `;
  exportPanel.appendChild(dataExportDiv);
  
  // Обработчики для экспорта/импорта данных
  document.querySelector('.export-data-btn').addEventListener('click', exportData);
  document.querySelector('.import-data-btn').addEventListener('click', function() {
    document.getElementById('import-file').click();
  });
  
  document.getElementById('import-file').addEventListener('change', function(e) {
    importData(e.target.files[0]);
  });
  
  // Изменение цвета заливки и прозрачности
  document.getElementById('region-fill-color').addEventListener('input', function() {
    updateColorPreview();
  });
  
  document.getElementById('region-fill-opacity').addEventListener('input', function() {
    updateColorPreview();
  });
  
  document.getElementById('region-stroke-color').addEventListener('input', function() {
    updateColorPreview();
  });
  
  // Обработчики закрытия модальных окон
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = this.closest('.modal');
      hideModal(modal.id);
      
      // Если закрываем окно региона и есть активное взаимодействие рисования, удаляем его
      if (modal.id === 'region-modal' && drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
        isDrawingMode = false;
        document.querySelector('.draw-region-btn').textContent = 'Нарисовать на карте';
      }
      
      // Если закрываем окно точки и активен режим размещения точки, отключаем его
      if (modal.id === 'point-modal' && pointPlacementMode) {
        pointPlacementMode = false;
        document.querySelector('.place-on-map-btn').textContent = 'Указать на карте';
      }
    });
  });
  
  // Закрытие модального окна при клике на фон
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        hideModal(this.id);
        
        // Если закрываем окно региона и есть активное взаимодействие рисования, удаляем его
        if (this.id === 'region-modal' && drawInteraction) {
          map.removeInteraction(drawInteraction);
          drawInteraction = null;
          isDrawingMode = false;
          document.querySelector('.draw-region-btn').textContent = 'Нарисовать на карте';
        }
        
        // Если закрываем окно точки и активен режим размещения точки, отключаем его
        if (this.id === 'point-modal' && pointPlacementMode) {
          pointPlacementMode = false;
          document.querySelector('.place-on-map-btn').textContent = 'Указать на карте';
        }
      }
    });
  });
  
  // Обработчик для кнопки импорта JSON из overpass-turbo.eu
  document.querySelector('.import-json-btn').addEventListener('click', function() {
    const jsonTextarea = document.getElementById('overpass-json');
    
    // Переключаем видимость textarea
    if (jsonTextarea.style.display === 'none') {
      jsonTextarea.style.display = 'block';
      this.textContent = 'Импортировать';
    } else {
      // Парсим JSON и заполняем координаты
      const jsonString = jsonTextarea.value.trim();
      if (!jsonString) {
        alert('Пожалуйста, вставьте JSON из overpass-turbo.eu');
        return;
      }
      
      try {
        const jsonData = JSON.parse(jsonString);
        importCoordinatesFromOverpassJSON(jsonData);
        // Скрываем textarea после успешного импорта
        jsonTextarea.style.display = 'none';
        this.textContent = 'Импортировать JSON из overpass-turbo.eu';
      } catch (e) {
        alert('Ошибка при парсинге JSON: ' + e.message);
      }
    }
  });
  
  // Обработчик формы редактирования датасета
  document.getElementById('edit-dataset-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Получаем данные из формы
    const datasetKey = document.getElementById('edit-dataset-key').value;
    const newName = document.getElementById('edit-dataset-name').value.trim();
    
    // Проверяем обязательные поля
    if (!newName) {
      alert('Пожалуйста, введите название датасета');
      return;
    }
    
    // Обновляем название датасета
    if (updateDatasetName(datasetKey, newName)) {
      // Если успешно, закрываем модальное окно
      hideModal('edit-dataset-modal');
    }
  });
  
  // Обработчик для кнопки импорта по OSM ID
  document.getElementById('import-osm-id-btn').addEventListener('click', function() {
    // Заполняем селект датасетов
    const datasetSelect = document.getElementById('import-dataset-select');
    datasetSelect.innerHTML = '';
    
    Object.entries(appData.datasets).forEach(([key, dataset]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = dataset.name;
      if (key === appData.currentDataset) {
        option.selected = true;
      }
      datasetSelect.appendChild(option);
    });
    
    // Очищаем поле имени региона
    document.getElementById('import-region-name').value = '';
    document.getElementById('osm-relation-id').value = '';
    
    // Показываем модальное окно
    showModal('import-osm-id-modal');
  });
  
  // Добавляем обработчик изменения OSM ID для автозаполнения имени региона
  document.getElementById('osm-relation-id').addEventListener('blur', function() {
    const osmId = this.value.trim();
    if (osmId) {
      fetchOsmRegionName(osmId);
    }
  });
  
  // Обработчик формы импорта по OSM ID
  document.getElementById('import-osm-id-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const osmId = document.getElementById('osm-relation-id').value.trim();
    if (!osmId) {
      alert('Пожалуйста, введите ID отношения OSM');
      return;
    }
    
    const datasetKey = document.getElementById('import-dataset-select').value;
    if (!datasetKey) {
      alert('Пожалуйста, выберите датасет');
      return;
    }
    
    const regionName = document.getElementById('import-region-name').value.trim();
    if (!regionName) {
      alert('Пожалуйста, введите название региона');
      return;
    }
    
    const fillColor = document.getElementById('import-fill-color').value;
    const fillOpacity = document.getElementById('import-fill-opacity').value;
    const strokeColor = document.getElementById('import-stroke-color').value;
    
    // Закрываем модальное окно
    hideModal('import-osm-id-modal');
    
    // Импортируем регион
    importRegionByOsmId(osmId, datasetKey, regionName, fillColor, fillOpacity, strokeColor);
  });
}

// Функция обновления превью цвета
function updateColorPreview() {
  const fillColor = document.getElementById('region-fill-color').value;
  const fillOpacity = document.getElementById('region-fill-opacity').value;
  const strokeColor = document.getElementById('region-stroke-color').value;
  
  console.log('Обновляем превью:', {
    fillColor,
    fillOpacity,
    strokeColor,
    rgb: hexToRgb(fillColor)
  });
  
  // Обновляем стиль превью заливки
  const fillPreview = document.getElementById('region-color-preview');
  if (fillPreview) {
    fillPreview.style.width = '30px';
    fillPreview.style.height = '30px';
    fillPreview.style.borderRadius = '4px';
    fillPreview.style.display = 'inline-block';
    fillPreview.style.backgroundColor = `rgba(${hexToRgb(fillColor)}, ${fillOpacity})`;
    fillPreview.style.border = `1px solid ${strokeColor}`;
    
    console.log('Применены стили:', fillPreview.style.backgroundColor, fillPreview.style.border);
  } else {
    console.error('Элемент #region-color-preview не найден!');
  }
}

// Функция для создания круглой иконки на основе фото
function createCircleIcon(photoUrl, callback) {
  // Проверка кэша
  if (appData.iconCache && appData.iconCache[photoUrl]) {
    callback(appData.iconCache[photoUrl]);
    return;
  }
  
  // Инициализация кэша иконок, если он еще не создан
  if (!appData.iconCache) {
    appData.iconCache = {};
  }

  // Создаем временное изображение
  const img = new Image();
  
  // Помогает с CORS
  img.crossOrigin = 'anonymous';
  
  img.onload = function() {
    // Получаем контекст холста
    const canvas = document.getElementById('iconCanvas');
    const ctx = canvas.getContext('2d');
    
    // Очищаем холст
    ctx.clearRect(0, 0, 64, 64);
    
    // Рисуем круг и обрезаем изображение
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    
    // Рисуем изображение в круге
    ctx.drawImage(img, 0, 0, 64, 64);
    
    // Добавляем белую рамку
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Получаем URL данных изображения
    const dataUrl = canvas.toDataURL('image/png');
    
    // Кэшируем результат
    appData.iconCache[photoUrl] = dataUrl;
    
    // Вызываем callback с результатом
    callback(dataUrl);
  };
  
  img.onerror = function() {
    // В случае ошибки загрузки, используем заглушку
    const fallbackUrl = 'https://placehold.co/64x64/gray/white?text=Photo';
    appData.iconCache[photoUrl] = fallbackUrl;
    callback(fallbackUrl);
  };
  
  img.src = photoUrl;
}

// Обновление списка датасетов
function updateDatasetList() {
  const container = elements.datasetList;
  container.innerHTML = '';
  
  Object.entries(appData.datasets).forEach(([key, dataset]) => {
    const item = document.createElement('div');
    item.className = 'dataset-item';
    item.innerHTML = `
      <div class="dataset-info">
        <span class="dataset-name">${dataset.name}</span>
        <small class="dataset-key">(${key})</small>
      </div>
      <div class="dataset-actions">
        <button class="btn btn-sm set-active-btn" data-key="${key}">Активировать</button>
        <button class="btn btn-sm edit-btn" data-key="${key}">Редактировать</button>
        <button class="btn btn-sm duplicate-btn" data-key="${key}">Дублировать</button>
        <button class="btn btn-sm delete-btn" data-key="${key}">Удалить</button>
      </div>
    `;
    
    // Выделяем активный датасет
    if (key === appData.currentDataset) {
      item.classList.add('active');
    }
    
    container.appendChild(item);
  });
  
  // Обработчики событий для кнопок
  container.querySelectorAll('.set-active-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const key = this.getAttribute('data-key');
      appData.currentDataset = key;
      updateDatasetList();
      loadPolygonsForDataset(key);
      pinsSource.clear();
      saveData();
      populateDatasetSelects();
    });
  });

  // Обработчик для кнопки редактирования
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const key = this.getAttribute('data-key');
      editDataset(key);
    });
  });
  
  container.querySelectorAll('.duplicate-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const key = this.getAttribute('data-key');
      duplicateDataset(key);
    });
  });
  
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (confirm('Вы уверены, что хотите удалить этот датасет? Все связанные регионы и точки будут также удалены.')) {
        const key = this.getAttribute('data-key');
        try {
          // Вместо прямого удаления используем функцию deleteDataset
          deleteDataset(key);
          
          // Обновляем интерфейс
          updateDatasetList();
          populateDatasetSelects();
          
          // Если удалён текущий датасет, очищаем слои на карте
          if (appData.currentDataset === null) {
            regionsSource.clear();
            pinsSource.clear();
          } else {
            // Загружаем данные текущего датасета
            loadPolygonsForDataset(appData.currentDataset);
          }
          
          // Сохраняем изменения
          saveData();
        } catch (error) {
          alert(error.message);
        }
      }
    });
  });
  
  // Обновляем селекты
  populateDatasetSelects();
}

function duplicateDataset(sourceKey) {
  console.log('Дублирование датасета:', sourceKey);
  console.log('Исходные данные:', {
    dataset: appData.datasets[sourceKey],
    polygons: appData.polygons[sourceKey],
    pins: appData.pins[sourceKey]
  });

  // Создаем новый ключ, добавляя "(1)" или увеличивая число в скобках
  let newKey = sourceKey;
  let counter = 1;
  let suffix = '(1)';
  
  while (appData.datasets[newKey + suffix]) {
    counter++;
    suffix = `(${counter})`;
  }
  newKey = sourceKey + suffix;
  
  // Копируем датасет
  const sourceDataset = appData.datasets[sourceKey];
  appData.datasets[newKey] = {
    name: sourceDataset.name + suffix,
    key: newKey
  };
  
  // Копируем полигоны
  if (!appData.polygons) appData.polygons = {};
  appData.polygons[newKey] = [];
  
  if (appData.polygons[sourceKey]) {
    // Копируем каждый полигон и обновляем его имя
    appData.polygons[newKey] = appData.polygons[sourceKey].map(polygon => {
      const newPolygon = JSON.parse(JSON.stringify(polygon));
      // Обновляем имя региона, добавляя к нему суффикс, если оно содержит ключ исходного датасета
      const oldName = newPolygon.properties.name;
      if (oldName.includes(sourceKey)) {
        newPolygon.properties.name = oldName.replace(sourceKey, newKey);
      }
      return newPolygon;
    });
  }
  
  // Копируем пины
  if (!appData.pins) appData.pins = {};
  appData.pins[newKey] = {};
  
  if (appData.pins[sourceKey]) {
    // Для каждого региона в исходном датасете
    Object.keys(appData.pins[sourceKey]).forEach(regionName => {
      // Создаем новое имя региона, заменяя старый ключ датасета на новый
      const newRegionName = regionName.includes(sourceKey) ? 
        regionName.replace(sourceKey, newKey) : regionName;
      
      // Копируем массив пинов для региона
      appData.pins[newKey][newRegionName] = JSON.parse(
        JSON.stringify(appData.pins[sourceKey][regionName])
      );
    });
  }
  
  console.log('Новые данные:', {
    dataset: appData.datasets[newKey],
    polygons: appData.polygons[newKey],
    pins: appData.pins[newKey]
  });
  
  // Устанавливаем новый датасет как текущий
  appData.currentDataset = newKey;
  
  // Сохраняем изменения
  saveData();
  
  // Обновляем интерфейс
  updateDatasetList();
  
  // Загружаем полигоны для нового датасета
  loadPolygonsForDataset(newKey);
  
  // Обновляем списки регионов и точек
  updateRegionList();
  updatePointList();
}

// Обновление списка регионов
function updateRegionList() {
  const container = elements.regionList;
  container.innerHTML = '';
  
  const datasetKey = document.getElementById('region-dataset-select').value || appData.currentDataset;
  const regions = getPolygons(datasetKey);
  
  regions.forEach(region => {
    const item = document.createElement('div');
    item.className = 'region-item';
    item.innerHTML = `
      <div class="region-info">
        <span class="region-name">${region.properties.name}</span>
        <span class="region-color" style="background-color:${region.properties.fillColor}"></span>
      </div>
      <div class="region-actions">
        <button class="btn btn-sm show-region-btn" data-name="${region.properties.name}">Показать</button>
        <button class="btn btn-sm edit-region-btn" data-index="${regions.indexOf(region)}">Редактировать</button>
        <button class="btn btn-sm delete-region-btn" data-name="${region.properties.name}">Удалить</button>
      </div>
    `;
    container.appendChild(item);
  });
  
  // Обработчики событий для кнопок
  container.querySelectorAll('.show-region-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const name = this.getAttribute('data-name');
      const region = regions.find(r => r.properties.name === name);
      
      if (region) {
        // Находим границы региона и приближаем к нему
        const format = new ol.format.GeoJSON();
        const feature = format.readFeature(region, {
          featureProjection: 'EPSG:3857'
        });
        
        const extent = feature.getGeometry().getExtent();
        map.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          duration: 500
        });
        
        // Показываем пины для этого региона
        showPinsForRegion(name);
      }
    });
  });
  
  container.querySelectorAll('.edit-region-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      const region = regions[index];
      
      // Заполняем форму данными региона
      document.getElementById('region-dataset').value = datasetKey;
      document.getElementById('region-name').value = region.properties.name;
      
      // Сохраняем старое имя региона в скрытом поле
      if (!document.getElementById('region-old-name')) {
        const oldNameField = document.createElement('input');
        oldNameField.type = 'hidden';
        oldNameField.id = 'region-old-name';
        document.getElementById('region-form').appendChild(oldNameField);
      }
      document.getElementById('region-old-name').value = region.properties.name;
      
      // Получаем цвет заливки и прозрачность
      const fillColor = region.properties.fillColor;
      let rgbaMatch = fillColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      
      if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        const opacity = parseFloat(rgbaMatch[4]);
        
        document.getElementById('region-fill-color').value = rgbToHex(r, g, b);
        document.getElementById('region-fill-opacity').value = opacity;
      }
      
      // Получаем цвет границы
      document.getElementById('region-stroke-color').value = region.properties.strokeColor;
      
      // Заполняем координаты
      const coordContainer = document.getElementById('coordinates-container');
      coordContainer.innerHTML = '';
      
      // Создаем скрытое поле для хранения типа геометрии
      if (!document.getElementById('region-geometry-type')) {
        const geometryTypeField = document.createElement('input');
        geometryTypeField.type = 'hidden';
        geometryTypeField.id = 'region-geometry-type';
        document.getElementById('region-form').appendChild(geometryTypeField);
      }
      
      // Сохраняем тип геометрии
      const geometryType = region.geometry.type;
      document.getElementById('region-geometry-type').value = geometryType;
      
      // В зависимости от типа геометрии, по-разному обрабатываем координаты
      if (geometryType === 'Polygon') {
        // Стандартный полигон - показываем координаты первого кольца
        const coords = region.geometry.coordinates[0];
        
        // Добавляем точки полигона (кроме последней, которая дублирует первую)
        addPolygonPointsToForm(coords, coordContainer);
      } 
      else if (geometryType === 'MultiPolygon') {
        // Для MultiPolygon мы создаем сообщение, что редактирование координат невозможно
        // и предлагаем только изменить цвет и имя
        const warningDiv = document.createElement('div');
        warningDiv.className = 'alert alert-warning';
        warningDiv.style.marginBottom = '15px';
        warningDiv.innerHTML = `
          <p><strong>Внимание:</strong> Этот регион является составным (MultiPolygon) и был импортирован из OSM.</p>
          <p>Редактирование отдельных точек такого объекта невозможно. Вы можете изменить имя и цвет региона.</p>
        `;
        coordContainer.appendChild(warningDiv);
        
        // Добавляем информацию о полигоне
        const infoDiv = document.createElement('div');
        infoDiv.className = 'region-info';
        infoDiv.innerHTML = `
          <p>Информация о полигоне:</p>
          <ul>
            <li>Тип: MultiPolygon</li>
            <li>Количество частей: ${region.geometry.coordinates.length}</li>
          </ul>
        `;
        coordContainer.appendChild(infoDiv);
        
        // Сохраняем оригинальные координаты в скрытое поле
        if (!document.getElementById('original-coordinates')) {
          const origCoordsField = document.createElement('input');
          origCoordsField.type = 'hidden';
          origCoordsField.id = 'original-coordinates';
          document.getElementById('region-form').appendChild(origCoordsField);
        }
        document.getElementById('original-coordinates').value = JSON.stringify(region.geometry.coordinates);
      }
      
      // Показываем модальное окно
      showModal('region-modal');
      
      // Прямая установка стилей предпросмотра
      const preview = document.getElementById('region-color-preview');
      if (preview) {
        const fillRgb = hexToRgb(document.getElementById('region-fill-color').value);
        const fillOpacity = document.getElementById('region-fill-opacity').value;
        const strokeColor = document.getElementById('region-stroke-color').value;
        
        preview.style.width = '30px';
        preview.style.height = '30px';
        preview.style.borderRadius = '4px';
        preview.style.display = 'inline-block';
        preview.style.backgroundColor = `rgba(${fillRgb}, ${fillOpacity})`;
        preview.style.border = `1px solid ${strokeColor}`;
      }
      
      // Обновляем превью цвета
      updateColorPreview();
      
      // Добавляем обработчики событий для полей цвета
      document.getElementById('region-fill-color').addEventListener('input', updateColorPreview);
      document.getElementById('region-fill-opacity').addEventListener('input', updateColorPreview);
      document.getElementById('region-stroke-color').addEventListener('input', updateColorPreview);
      
      // Добавляем обработчики для новых кнопок удаления
      coordContainer.querySelectorAll('.remove-coord-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          if (coordContainer.querySelectorAll('.coordinate-pair').length > 1) {
            this.closest('.coordinate-pair').remove();
          } else {
            alert('Должна остаться хотя бы одна пара координат');
          }
        });
      });
    });
  });
  
  container.querySelectorAll('.delete-region-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (confirm('Вы уверены, что хотите удалить этот регион? Все связанные точки будут также удалены.')) {
        const name = this.getAttribute('data-name');
        try {
          deleteRegion(datasetKey, name);
          // Обновляем интерфейс
          updateRegionList();
          updatePointList();
          loadPolygonsForDataset(datasetKey);
          pinsSource.clear();
          // Сохраняем изменения
          saveData();
        } catch (error) {
          alert(error.message);
        }
      }
    });
  });
}

// Обновление списка точек
function updatePointList() {
  const container = elements.pointList;
  container.innerHTML = '';
  
  const datasetKey = document.getElementById('point-dataset-select').value || appData.currentDataset;
  const regionName = document.getElementById('point-region-select').value;
  
  // Если нет выбранного региона, показываем сообщение
  if (!regionName || regionName === '') {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.innerHTML = '<p>Выберите регион для просмотра точек или сначала создайте регион, если их еще нет.</p>';
    container.appendChild(emptyMessage);
    return;
  }
  
  const points = getPins(datasetKey, regionName);
  
  // Если точек нет, показываем сообщение
  if (points.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.innerHTML = '<p>В этом регионе пока нет точек. Добавьте точку, нажав кнопку "Добавить точку".</p>';
    container.appendChild(emptyMessage);
    return;
  }
  
  points.forEach(point => {
    const item = document.createElement('div');
    item.className = 'point-item';
    item.innerHTML = `
      <div class="point-info">
        <img src="${point.photo}" class="point-thumbnail">
        <div class="point-details">
          <span class="point-name">${point.name}</span>
          <small class="point-city">${point.city || ''}</small>
        </div>
      </div>
      <div class="point-actions">
        <button class="btn btn-sm edit-point-btn" data-index="${points.indexOf(point)}">Редактировать</button>
        <button class="btn btn-sm delete-point-btn" data-index="${points.indexOf(point)}">Удалить</button>
      </div>
    `;
    container.appendChild(item);
  });
  
  // Обработчики событий для кнопок
  container.querySelectorAll('.edit-point-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      const point = points[index];
      
      // Заполняем форму данными точки
      const modalDatasetSelect = document.getElementById('point-dataset');
      modalDatasetSelect.value = datasetKey;
      
      // Обновляем список регионов для выбранного датасета
      console.log('Обновление списка регионов для редактирования точки, датасет:', datasetKey);
      populateRegionSelect(datasetKey, 'point-region-select-modal');
      
      document.getElementById('point-region-select-modal').value = regionName;
      document.getElementById('point-name').value = point.name;
      document.getElementById('point-city').value = point.city || '';
      document.getElementById('point-quote').value = point.quote || '';
      document.getElementById('point-photo').value = point.photo;
      document.getElementById('point-video').value = point.video || '';
      document.getElementById('point-lon').value = point.coords[0];
      document.getElementById('point-lat').value = point.coords[1];
      
      // Устанавливаем индекс точки в скрытое поле
      if (!document.getElementById('point-index')) {
        console.log('Создаем скрытое поле point-index');
        const indexField = document.createElement('input');
        indexField.type = 'hidden';
        indexField.id = 'point-index';
        document.getElementById('point-form').appendChild(indexField);
        console.log('Скрытое поле point-index создано');
      } else {
        console.log('Скрытое поле point-index уже существует');
      }
      document.getElementById('point-index').value = index;
      console.log('Установлено значение point-index =', index);
      
      // Добавляем скрытые поля для сохранения оригинального датасета и региона
      if (!document.getElementById('original-dataset')) {
        const originalDatasetField = document.createElement('input');
        originalDatasetField.type = 'hidden';
        originalDatasetField.id = 'original-dataset';
        document.getElementById('point-form').appendChild(originalDatasetField);
        console.log('Скрытое поле original-dataset создано');
      }
      
      if (!document.getElementById('original-region')) {
        const originalRegionField = document.createElement('input');
        originalRegionField.type = 'hidden';
        originalRegionField.id = 'original-region';
        document.getElementById('point-form').appendChild(originalRegionField);
        console.log('Скрытое поле original-region создано');
      }
      
      // Сохраняем информацию о текущем датасете и регионе
      document.getElementById('original-dataset').value = datasetKey;
      document.getElementById('original-region').value = regionName;
      console.log('Сохранены оригинальные значения: датасет =', datasetKey, ', регион =', regionName);
      
      // Показываем предпросмотр фото
      const previewContainer = document.getElementById('photo-preview');
      previewContainer.innerHTML = `<img src="${point.photo}" alt="Preview" style="max-width:100%">`;
      
      // Удаляем существующий временный маркер
      if (activePointFeature) {
        pinsSource.removeFeature(activePointFeature);
        activePointFeature = null;
      }
      
      // Создаем новый маркер
      const coordinate = ol.proj.fromLonLat(point.coords);
      activePointFeature = new ol.Feature({
        geometry: new ol.geom.Point(coordinate)
      });
      
      activePointFeature.setStyle(new ol.style.Style({
        image: new ol.style.Circle({
          radius: 7,
          fill: new ol.style.Fill({
            color: '#ff0000'
          }),
          stroke: new ol.style.Stroke({
            color: '#ffffff',
            width: 2
          })
        })
      }));
      
      pinsSource.addFeature(activePointFeature);
      
      // Центрируем карту на точке
      map.getView().animate({
        center: coordinate,
        zoom: 10,
        duration: 500
      });
      
      // Удаляем существующий обработчик, чтобы избежать дублирования
      modalDatasetSelect.onchange = function() {
        const selectedDataset = this.value;
        console.log('Изменение датасета в модальном окне точки (редактирование):', selectedDataset);
        populateRegionSelect(selectedDataset, 'point-region-select-modal');
      };
      
      // Показываем модальное окно
      showModal('point-modal');
    });
  });
  
  container.querySelectorAll('.delete-point-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (confirm('Вы уверены, что хотите удалить эту точку?')) {
        const index = parseInt(this.getAttribute('data-index'));
        try {
          deletePin(datasetKey, regionName, index);
          // Обновляем интерфейс
          updatePointList();
          
          // Обновляем точки на карте
          if (appData.currentDataset === datasetKey) {
            showPinsForRegion(regionName);
          }
          
          // Сохраняем изменения
          saveData();
        } catch (error) {
          alert(error.message);
        }
      }
    });
  });
}

// Заполнение селектов датасетов
function populateDatasetSelects() {
  const datasets = getDatasets();
  
  // Селект для регионов
  const regionSelect = document.getElementById('region-dataset-select');
  const selectedRegionDataset = regionSelect.value || appData.currentDataset;
  regionSelect.innerHTML = '';
  
  // Селект для точек
  const pointSelect = document.getElementById('point-dataset-select');
  const selectedPointDataset = pointSelect.value || appData.currentDataset;
  pointSelect.innerHTML = '';
  
  // Селект в форме региона
  const regionFormSelect = document.getElementById('region-dataset');
  const selectedRegionFormDataset = regionFormSelect.value || appData.currentDataset;
  regionFormSelect.innerHTML = '';
  
  // Селект в форме точки
  const pointFormSelect = document.getElementById('point-dataset');
  const selectedPointFormDataset = pointFormSelect ? pointFormSelect.value || appData.currentDataset : appData.currentDataset;
  if (pointFormSelect) pointFormSelect.innerHTML = '';
  
  datasets.forEach(dataset => {
    // Для основного селекта регионов
    const regionOption = document.createElement('option');
    regionOption.value = dataset.key;
    regionOption.textContent = dataset.name;
    if (dataset.key === selectedRegionDataset) {
      regionOption.selected = true;
    }
    regionSelect.appendChild(regionOption);
    
    // Для селекта точек
    const pointOption = document.createElement('option');
    pointOption.value = dataset.key;
    pointOption.textContent = dataset.name;
    if (dataset.key === selectedPointDataset) {
      pointOption.selected = true;
    }
    pointSelect.appendChild(pointOption);
    
    // Для селекта в форме региона
    const regionFormOption = document.createElement('option');
    regionFormOption.value = dataset.key;
    regionFormOption.textContent = dataset.name;
    if (dataset.key === selectedRegionFormDataset) {
      regionFormOption.selected = true;
    }
    regionFormSelect.appendChild(regionFormOption);
    
    // Для селекта в форме точки
    if (pointFormSelect) {
      const pointFormOption = document.createElement('option');
      pointFormOption.value = dataset.key;
      pointFormOption.textContent = dataset.name;
      if (dataset.key === selectedPointFormDataset) {
        pointFormOption.selected = true;
      }
      pointFormSelect.appendChild(pointFormOption);
    }
  });
  
  // Обновляем селект регионов для вкладки точек
  populateRegionSelect(selectedPointDataset, 'point-region-select');
  
  // Убедимся, что в селекте регионов для точек выбран какой-то элемент
  const pointRegionSelect = document.getElementById('point-region-select');
  if (pointRegionSelect.options.length > 0 && pointRegionSelect.selectedIndex === -1) {
    pointRegionSelect.selectedIndex = 0;
  }
  
  // Также обновляем селект регионов для формы точки, если он существует
  if (pointFormSelect) {
    const selectedDataset = pointFormSelect.value || appData.currentDataset;
    populateRegionSelect(selectedDataset, 'point-region-select-modal');
  }
}

// Заполнение селекта регионов
function populateRegionSelect(datasetKey, selectId) {
  console.log(`Заполнение селекта регионов для датасета ${datasetKey} в элемент #${selectId}`);
  
  // Получаем массив регионов для выбранного датасета
  const regions = getPolygons(datasetKey);
  
  // Находим селект в DOM
  const select = document.getElementById(selectId);
  
  if (!select) {
    console.error(`Элемент #${selectId} не найден!`);
    return;
  }
  
  // Сохраняем текущее значение перед очисткой
  const selectedValue = select.value;
  console.log(`Текущее выбранное значение селекта: "${selectedValue}"`);
  
  // Очищаем селект
  select.innerHTML = '';
  
  console.log(`Найдено ${regions.length} регионов для датасета ${datasetKey}`);
  
  // Проверка наличия регионов
  if (regions.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '-- Нет доступных регионов --';
    select.appendChild(option);
    console.log('Добавлен пустой выбор, так как нет регионов');
    return;
  }
  
  // Проверяем, существует ли выбранное значение в новом списке регионов
  let valueExists = false;
  
  // Добавляем регионы в селект
  regions.forEach(region => {
    const option = document.createElement('option');
    option.value = region.properties.name;
    option.textContent = region.properties.name;
    
    // Если текущее значение соответствует этому региону, выбираем его
    if (region.properties.name === selectedValue) {
      option.selected = true;
      valueExists = true;
      console.log(`Найдено совпадение с текущим выбором: ${region.properties.name}`);
    }
    
    select.appendChild(option);
    console.log(`Добавлен регион: ${region.properties.name}`);
  });
  
  // Если раньше выбранного значения нет в новом списке, выбираем первый элемент
  if (!valueExists && regions.length > 0) {
    select.selectedIndex = 0;
    console.log(`Выбранное значение "${selectedValue}" не найдено в новом списке. Выбран регион по умолчанию: ${select.options[0].textContent}`);
  }
}

// Управление отображением модальных окон
function showModal(modalId) {
  console.log(`Вызвана функция showModal('${modalId}')`);
  const modal = document.getElementById(modalId);
  if (modal) {
    console.log(`Найден элемент #${modalId}, показываем с анимацией`);
    modal.style.display = 'flex';
    // Небольшая задержка для корректной анимации
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
  } else {
    console.error(`Элемент #${modalId} не найден!`);
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    // Ждем окончания анимации перед скрытием элемента
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300); // Время должно совпадать с transition в CSS
  }
}

// RGB в Hex
function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Hex в RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? 
    parseInt(result[1], 16) + ', ' + parseInt(result[2], 16) + ', ' + parseInt(result[3], 16) : 
    '0, 0, 0';
}

// Загрузка полигонов для датасета
function loadPolygonsForDataset(datasetKey) {
  // Очищаем источники при загрузке нового датасета
  regionsSource.clear();
  pinsSource.clear(); // Очищаем точки при смене датасета
  
  // Проверяем, что datasetKey указан
  if (!datasetKey) {
    console.warn('Не указан ключ датасета для загрузки полигонов');
    return;
  }
  
  // Проверяем наличие полигонов для датасета
  const polygons = appData.polygons[datasetKey] || [];
  
  if (polygons.length === 0) {
    console.log('Нет полигонов для датасета:', datasetKey);
    return;
  }
  
  console.log('Загружаем полигоны для датасета:', datasetKey, '- количество:', polygons.length);
  
  try {
    // Проверяем все полигоны перед загрузкой
    const validFeatures = [];
    
    polygons.forEach((polygon, index) => {
      // Проверяем наличие полигона
      if (!polygon) {
        console.warn(`Пропущен пустой полигон с индексом ${index}`);
        return;
      }
      
      // Проверяем, полигон уже в формате GeoJSON или нет
      if (!polygon.type || !polygon.geometry) {
        console.warn(`Полигон #${index} не в формате GeoJSON, попытка преобразования`);
        
        // Пытаемся конвертировать в GeoJSON если возможно
        try {
          const newPolygon = {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: polygon.coordinates ? [polygon.coordinates] : [[]]
            },
            properties: {
              name: polygon.name || `Регион ${index+1}`,
              fillColor: polygon.fillColor || 'rgba(255,165,0,0.3)',
              strokeColor: polygon.strokeColor || '#ff6400'
            }
          };
          polygon = newPolygon;
          appData.polygons[datasetKey][index] = newPolygon; // Обновляем в исходных данных
        } catch (e) {
          console.error(`Ошибка преобразования полигона #${index}:`, e);
          return; // Пропускаем этот полигон
        }
      }
      
      // Проверяем структуру GeoJSON
      if (!polygon.geometry || !polygon.geometry.coordinates) {
        console.warn(`Пропущен полигон #${index} с некорректной геометрией:`, polygon);
        return;
      }
      
      // Проверяем наличие properties, добавляем если их нет
      if (!polygon.properties) {
        console.warn(`Полигон #${index} не имеет properties, добавляем`);
        polygon.properties = {
          name: polygon.name || `Регион ${index+1}`,
          fillColor: polygon.fillColor || 'rgba(255,165,0,0.3)',
          strokeColor: polygon.strokeColor || '#ff6400'
        };
      }
      
      validFeatures.push(polygon);
    });
    
    console.log(`Найдено ${validFeatures.length} валидных полигонов из ${polygons.length}`);
    
    if (validFeatures.length === 0) {
      console.warn('Нет валидных полигонов для загрузки');
      return;
    }
    
    // Создаем коллекцию геометрий из GeoJSON
    const features = new ol.format.GeoJSON().readFeatures({
      type: 'FeatureCollection',
      features: validFeatures
    }, {
      featureProjection: 'EPSG:3857'
    });
    
    // Устанавливаем свойства для каждого полигона
    features.forEach(feature => {
      const props = feature.getProperties();
      if (props.properties) {
        // Если свойства находятся в подобъекте properties (стандартный GeoJSON)
        feature.setProperties({
          name: props.properties.name,
          fillColor: props.properties.fillColor,
          strokeColor: props.properties.strokeColor
        });
      }
    });
    
    // Добавляем полигоны на карту
    regionsSource.addFeatures(features);
    
    // Центрируем карту на полигонах, если они есть
    if (features.length > 0) {
      const extent = regionsSource.getExtent();
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 500
      });
    }
  } catch (error) {
    console.error('Ошибка при загрузке полигонов стандартным методом:', error);
    
    // Резервный метод для полигонов в старом формате или в случае ошибки
    console.log('Применяем резервный метод загрузки полигонов');
    
    let loadedCount = 0;
    polygons.forEach((polygon, index) => {
      try {
        // Пропускаем пустые полигоны
        if (!polygon) {
          console.warn(`Резервный метод: пропущен пустой полигон с индексом ${index}`);
          return;
        }
        
        let feature;
        
        if (polygon.type === 'Feature' && polygon.geometry) {
          if (polygon.geometry.type === 'Polygon' && polygon.geometry.coordinates && polygon.geometry.coordinates.length > 0) {
            // Создаем объект с геометрией в формате Polygon
            feature = new ol.Feature({
              geometry: new ol.geom.Polygon(polygon.geometry.coordinates.map(ring => 
                ring.map(coord => ol.proj.fromLonLat(coord))
              )),
              name: (polygon.properties && polygon.properties.name) || polygon.name || `Регион ${index+1}`,
              fillColor: (polygon.properties && polygon.properties.fillColor) || polygon.fillColor || 'rgba(255,165,0,0.3)',
              strokeColor: (polygon.properties && polygon.properties.strokeColor) || polygon.strokeColor || '#ff6400'
            });
          } else if (polygon.geometry.type === 'MultiPolygon' && polygon.geometry.coordinates && polygon.geometry.coordinates.length > 0) {
            // Создаем объект с геометрией в формате MultiPolygon
            const multiPolygon = new ol.geom.MultiPolygon(polygon.geometry.coordinates.map(poly => 
              poly.map(ring => 
                ring.map(coord => ol.proj.fromLonLat(coord))
              )
            ));
            feature = new ol.Feature({
              geometry: multiPolygon,
              name: (polygon.properties && polygon.properties.name) || polygon.name || `Регион ${index+1}`,
              fillColor: (polygon.properties && polygon.properties.fillColor) || polygon.fillColor || 'rgba(255,165,0,0.3)',
              strokeColor: (polygon.properties && polygon.properties.strokeColor) || polygon.strokeColor || '#ff6400'
            });
          }
        } else if (polygon.coordinates && polygon.coordinates.length > 0) {
          // Старый формат с прямым массивом координат
          feature = new ol.Feature({
            geometry: new ol.geom.Polygon([polygon.coordinates.map(coord => ol.proj.fromLonLat(coord))]),
            name: polygon.name || `Регион ${index+1}`,
            fillColor: polygon.fillColor || 'rgba(255,165,0,0.3)',
            strokeColor: polygon.strokeColor || '#ff6400'
          });
        }
        
        if (feature) {
          regionsSource.addFeature(feature);
          loadedCount++;
        } else {
          console.warn(`Резервный метод: не удалось создать Feature для полигона #${index}`, polygon);
        }
      } catch (e) {
        console.error(`Резервный метод: ошибка при добавлении полигона #${index}:`, e, polygon);
      }
    });
    
    console.log(`Резервный метод: загружено ${loadedCount} полигонов из ${polygons.length}`);
    
    // Если есть загруженные полигоны, центрируем карту
    if (loadedCount > 0) {
      const extent = regionsSource.getExtent();
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 500
      });
    }
  }
  
  // Устанавливаем название датасета только если элемент существует
  const currentDatasetNameElement = document.getElementById('current-dataset-name');
  if (currentDatasetNameElement && appData.datasets[datasetKey]) {
    currentDatasetNameElement.textContent = appData.datasets[datasetKey].name;
  }
}

// Показать точки для конкретного региона
function showPinsForRegion(regionName) {
  pinsSource.clear();
  const datasetPins = appData.pins[appData.currentDataset];
  if (!datasetPins) return;

  const regionPins = datasetPins[regionName];
  if (!regionPins) return;
  
  console.log('Показываем точки для региона:', regionName, '- количество:', regionPins.length);
  
  regionPins.forEach((item, index) => {
    // Создаем круглую иконку на основе фото
    createCircleIcon(item.photo, function(iconDataUrl) {
      const coords = item.coords || [item.lon, item.lat]; // Поддержка обоих форматов
      const feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(coords)),
        data: item,
        region: regionName,
        index: index
      });
      
      // Применяем стиль с иконкой
      feature.setStyle(new ol.style.Style({
        image: new ol.style.Icon({
          anchor: [0.5, 1],
          src: iconDataUrl,
          scale: 1.0 // Возвращаем нормальный размер
        })
      }));
      
      pinsSource.addFeature(feature);
    });
  });
}

// Показ поп-апа для точки
function showPinPopup(feature) {
  const data = feature.get('data');
  if (!data) return;

  // Заполняем контент
  const popupContent = `
    <img class="popup-avatar" src="${data.photo}" alt="${data.name}" />
    <div class="popup-person-name">${data.name}</div>
    <div class="popup-person-city">${data.city || ''}</div>
    <div class="popup-quote">"${data.quote || ''}"</div>
    ${data.video ? `
    <div class="popup-video">
      <iframe
        src="${data.video}"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
    ` : ''}
  `;
  document.getElementById('popupContent').innerHTML = popupContent;

  // Показываем поп-ап с анимацией
  const popup = document.getElementById('fullscreenPopup');
  popup.style.display = 'block';
  // Небольшая задержка для корректной анимации
  setTimeout(() => {
    popup.classList.add('show');
  }, 10);
}

// Закрытие поп-апа
function closeFullScreenPopup() {
  const popup = document.getElementById('fullscreenPopup');
  popup.classList.remove('show');
  // Ждем окончания анимации перед скрытием элемента
  setTimeout(() => {
    popup.style.display = 'none';
  }, 300); // Время должно совпадать с transition в CSS
}

// Включение/выключение режима рисования
function toggleDrawingMode() {
  if (isDrawingMode) {
    // Отключаем режим рисования
    map.removeInteraction(drawInteraction);
    drawInteraction = null;
    document.querySelector('.draw-region-btn').textContent = 'Нарисовать на карте';
  } else {
    // Включаем режим рисования
    drawInteraction = new ol.interaction.Draw({
      source: regionsSource,
      type: 'Polygon'
    });
    
    drawInteraction.on('drawend', function(event) {
      // Получаем координаты
      const geometry = event.feature.getGeometry();
      const coords = geometry.getCoordinates()[0].map(coord => 
        ol.proj.toLonLat(coord)
      );
      
      // Заполняем форму координатами
      const container = document.getElementById('coordinates-container');
      container.innerHTML = '';
      
      coords.forEach((coord, i) => {
        // Пропускаем последнюю точку, так как она дублирует первую для замыкания полигона
        if (i === coords.length - 1) return;
        
        const pair = document.createElement('div');
        pair.className = 'coordinate-pair';
        pair.innerHTML = `
          <input type="number" step="0.0001" placeholder="Долгота" class="lon-input" value="${coord[0].toFixed(6)}" required>
          <input type="number" step="0.0001" placeholder="Широта" class="lat-input" value="${coord[1].toFixed(6)}" required>
          <button type="button" class="remove-coord-btn">-</button>
        `;
        container.appendChild(pair);
      });
      
      // Восстанавливаем видимость модального окна, если оно было скрыто
      if (document.getElementById('region-modal').style.display !== 'none') {
        restoreModalVisibility('region-modal');
      }
      
      // Отключаем режим рисования после создания полигона
      toggleDrawingMode();
    });
    
    map.addInteraction(drawInteraction);
    document.querySelector('.draw-region-btn').textContent = 'Отменить рисование';
    
    // Временно скрываем модальное окно, чтобы можно было рисовать на карте
    if (document.getElementById('region-modal').style.display !== 'none') {
      temporaryHideModal('region-modal');
    }
  }
  
  isDrawingMode = !isDrawingMode;
}

// Функция для удаления региона (расширение API data.js)
function deleteRegion(datasetKey, regionName) {
  if (!appData.polygons[datasetKey]) {
    throw new Error('Датасет не найден');
  }
  
  // Находим индекс региона
  const index = appData.polygons[datasetKey].findIndex(
    region => region.properties.name === regionName
  );
  
  if (index === -1) {
    throw new Error('Регион не найден');
  }
  
  // Удаляем регион
  appData.polygons[datasetKey].splice(index, 1);
  
  // Обновляем слой регионов
  loadPolygonsForDataset(datasetKey);
}

// Функция для удаления точки
function deletePin(datasetKey, regionName, index) {
  if (!appData.pins[datasetKey] || !appData.pins[datasetKey][regionName]) {
    throw new Error('Датасет или регион не найден');
  }
  
  appData.pins[datasetKey][regionName].splice(index, 1);
}


// Генерация HTML для экспорта
function generateHTML() {
  // Проверяем наличие текущего датасета
  if (!appData.currentDataset || !appData.datasets[appData.currentDataset]) {
    console.error('Ошибка: текущий датасет не определен или не существует');
    
    // Пытаемся установить первый доступный датасет
    const datasetKeys = Object.keys(appData.datasets);
    if (datasetKeys.length > 0) {
      appData.currentDataset = datasetKeys[0];
      console.log('Установлен первый доступный датасет:', appData.currentDataset);
    } else {
      alert('Ошибка: не найдены датасеты для экспорта HTML');
      return '';
    }
  }
  
  // Получаем все датасеты и активный датасет
  const datasets = Object.values(appData.datasets);
  const currentPolygons = appData.polygons[appData.currentDataset] || [];
  const currentPins = appData.pins[appData.currentDataset] || {};
  const datasetName = appData.datasets[appData.currentDataset].name || 'Карта';
  
  // Отображение отладочной информации
  console.log('Загружено полигонов:', currentPolygons.length);
  console.log('Первый полигон:', currentPolygons.length > 0 ? JSON.stringify(currentPolygons[0]) : 'нет полигонов');
  console.log('Регионы с пинами:', Object.keys(currentPins));
  
  // Мигрируем данные перед экспортом, чтобы они были в актуальном формате
  // Создаем копию данных, чтобы не изменять оригинальные
  const exportData = {
    datasets: JSON.parse(JSON.stringify(appData.datasets)),
    polygons: JSON.parse(JSON.stringify(appData.polygons)),
    pins: JSON.parse(JSON.stringify(appData.pins)),
    currentDataset: appData.currentDataset
  };
  
  // Очищаем данные от "мусора"
  cleanupData(exportData);
  
  // Применяем миграцию к копии данных
  migrateDataFormat(exportData);

  // Создаем JSON со всеми данными для экспорта
  const allDataJSON = JSON.stringify(exportData);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>${datasetName}</title>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/ol@latest/ol.css"
    type="text/css"
  />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      font-family: sans-serif;
      box-sizing: border-box;
    }

    .top-bar {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      height: 50px;
      background: #fff;
      box-shadow: 0 0 4px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      z-index: 999;
      padding: 0 10px;
      box-sizing: border-box;
    }
    
    .top-bar h1 {
      margin: 0;
      font-size: 18px;
    }
    
    .dataset-selector {
      margin-left: 20px;
    }
    
    .dataset-selector select {
      padding: 5px 10px;
      border-radius: 4px;
      border: 1px solid #ddd;
    }

    #map {
      position: absolute;
      top: 50px;
      left: 0; right: 0; bottom: 0;
    }

    .fullscreen-popup {
      position: fixed;
      top: 0; left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: none;
      z-index: 2000;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .fullscreen-popup.show {
      opacity: 1;
    }
    
    .popup-container {
      background: white;
      width: 90%;
      max-width: 800px;
      max-height: 90vh;
      margin: 5vh auto;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 5px 30px rgba(0,0,0,0.5);
      transform: translateY(30px);
      transition: transform 0.3s ease;
    }
    
    .fullscreen-popup.show .popup-container {
      transform: translateY(0);
    }
    
    .popup-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 20px;
      box-sizing: border-box;
      border-bottom: 1px solid #ddd;
    }
    
    .popup-header .popup-title {
      font-size: 18px;
      font-weight: 600;
    }
    
    .popup-header .popup-close {
      cursor: pointer;
      background: none;
      border: none;
      font-size: 18px;
    }
    
    .popup-content {
      width: 100%;
      max-width: 600px;
      margin: 20px auto;
      text-align: center;
      padding: 0 20px;
      box-sizing: border-box;
    }
    
    .popup-avatar {
      width: 200px;
      height: 200px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 15px;
    }
    
    .popup-person-name {
      font-size: 20px;
      font-weight: bold;
      margin: 5px 0;
    }
    
    .popup-person-city {
      color: #777;
      margin-bottom: 10px;
    }
    
    .popup-quote {
      font-style: italic;
      margin-bottom: 20px;
    }
    
    .popup-video {
      width: 100%;
      max-width: 100%;
      margin: 0 0 20px 0;
      position: relative;
      padding-bottom: 56.25%;
      height: 0;
      box-sizing: border-box;
    }
    
    .popup-video iframe {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      height: 100%;
      border: 0;
    }

    #iconCanvas {
      position: absolute;
      left: -9999px;
      top: -9999px;
      width: 64px;
      height: 64px;
    }
  </style>
</head>
<body>
  <!-- Скрытый холст для создания иконок -->
  <canvas id="iconCanvas" width="64" height="64"></canvas>

  <!-- Верхняя панель -->
  <div class="top-bar">
    <h1 id="current-dataset-name">${datasetName}</h1>
    <div class="dataset-selector">
      <select id="dataset-select"></select>
    </div>
  </div>

  <div id="map"></div>

  <div class="fullscreen-popup" id="fullscreenPopup">
    <div class="popup-container">
      <div class="popup-header">
        <div class="popup-title">Информация о человеке</div>
        <button class="popup-close" onclick="closeFullScreenPopup()">×</button>
      </div>
      <div class="popup-content" id="popupContent"></div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/ol@latest/dist/ol.js"></script>
  <script>
    // Полные данные приложения
    const appData = ${allDataJSON};
    
    // Текущий активный датасет
    let currentDataset = appData.currentDataset;
    
    // Кэш для иконок
    if (!appData.iconCache) {
      appData.iconCache = {};
    }
    
    // Удаляем функцию миграции, так как данные уже мигрированы перед экспортом
    
    // Выполняем миграцию сразу при загрузке
    // migrateDataFormat(appData); - больше не нужно
    
    // Создаем слои карты
    const osmLayer = new ol.layer.Tile({ source: new ol.source.OSM() });
    osmLayer.setZIndex(0);

    const regionsSource = new ol.source.Vector();
    const regionsLayer = new ol.layer.Vector({
      source: regionsSource,
      style: function(feature) {
        // Проверяем, есть ли прямые свойства или нужно искать их в properties
        const fillColor = feature.get('fillColor') || 
                         (feature.get('properties') && feature.get('properties').fillColor) || 
                         'rgba(0,0,0,0.1)';
        const strokeColor = feature.get('strokeColor') || 
                           (feature.get('properties') && feature.get('properties').strokeColor) || 
                           '#333';
        
        return new ol.style.Style({
          fill: new ol.style.Fill({
            color: fillColor
          }),
          stroke: new ol.style.Stroke({
            color: strokeColor,
            width: 2
          })
        });
      }
    });
    regionsLayer.setZIndex(1);

    const pinsSource = new ol.source.Vector();
    const pinsLayer = new ol.layer.Vector({ source: pinsSource });
    pinsLayer.setZIndex(9999);

    // Инициализация карты
    const map = new ol.Map({
      target: 'map',
      layers: [osmLayer, regionsLayer, pinsLayer],
      view: new ol.View({
        center: ol.proj.fromLonLat([49.3, 55.5]),
        zoom: 7
      })
    });

    // Клик по карте
    map.on('singleclick', function(evt) {
      const feature = map.forEachFeatureAtPixel(evt.pixel, function(f) {
        return f;
      });
      if (feature) {
        const geomType = feature.getGeometry().getType();
        if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
          const regionName = feature.get('name');
          showPinsForRegion(regionName);
        } else if (geomType === 'Point') {
          showPinPopup(feature);
        }
      }
    });

    // Показ поп-апа для точки
    function showPinPopup(feature) {
      const data = feature.get('data');
      if (!data) return;

      // Заполняем контент
      const popupContent = \`
        <img class="popup-avatar" src="\${data.photo}" alt="\${data.name}" />
        <div class="popup-person-name">\${data.name}</div>
        <div class="popup-person-city">\${data.city || ''}</div>
        <div class="popup-quote">"\${data.quote || ''}"</div>
        \${data.video ? \`
        <div class="popup-video">
          <iframe
            src="\${data.video}"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
        \` : ''}
      \`;
      document.getElementById('popupContent').innerHTML = popupContent;

      // Показываем поп-ап с анимацией
      const popup = document.getElementById('fullscreenPopup');
      popup.style.display = 'block';
      // Небольшая задержка для корректной анимации
      setTimeout(() => {
        popup.classList.add('show');
      }, 10);
    }

    // Закрытие поп-апа
    function closeFullScreenPopup() {
      const popup = document.getElementById('fullscreenPopup');
      popup.classList.remove('show');
      // Ждем окончания анимации перед скрытием элемента
      setTimeout(() => {
        popup.style.display = 'none';
      }, 300); // Время должно совпадать с transition в CSS
    }

    // Функция создания круглой иконки из фото
    function createCircleIcon(photoUrl, callback) {
      // Проверка кэша
      if (appData.iconCache && appData.iconCache[photoUrl]) {
        callback(appData.iconCache[photoUrl]);
        return;
      }
      
      // Инициализация кэша иконок, если он еще не создан
      if (!appData.iconCache) {
        appData.iconCache = {};
      }

      // Создаем временное изображение
      const img = new Image();
      
      // Помогает с CORS
      img.crossOrigin = 'anonymous';
      
      img.onload = function() {
        // Получаем контекст холста
        const canvas = document.getElementById('iconCanvas');
        const ctx = canvas.getContext('2d');
        
        // Очищаем холст
        ctx.clearRect(0, 0, 64, 64);
        
        // Рисуем круг и обрезаем изображение
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        
        // Рисуем изображение в круге
        ctx.drawImage(img, 0, 0, 64, 64);
        
        // Добавляем белую рамку
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Получаем URL данных изображения
        const dataUrl = canvas.toDataURL('image/png');
        
        // Кэшируем результат
        appData.iconCache[photoUrl] = dataUrl;
        
        // Вызываем callback с результатом
        callback(dataUrl);
      };
      
      img.onerror = function() {
        // В случае ошибки загрузки, используем заглушку
        const fallbackUrl = 'https://placehold.co/64x64/gray/white?text=Photo';
        appData.iconCache[photoUrl] = fallbackUrl;
        callback(fallbackUrl);
      };
      
      img.src = photoUrl;
    }

    // Загрузка полигонов для выбранного датасета
    function loadPolygonsForDataset(datasetKey) {
      regionsSource.clear();
      pinsSource.clear(); // Очищаем точки при смене датасета
      
      const polygons = appData.polygons[datasetKey] || [];
      
      if (polygons.length === 0) {
        console.log('Нет полигонов для датасета:', datasetKey);
        return;
      }
      
      console.log('Загружаем полигоны для датасета:', datasetKey, '- количество:', polygons.length);
      
      try {
        // Проверяем все полигоны перед загрузкой
        const validFeatures = [];
        polygons.forEach(polygon => {
          if (!polygon || !polygon.geometry || !polygon.geometry.coordinates) {
            console.warn('Пропущен некорректный полигон:', polygon);
            return;
          }
          // Принудительно добавляем properties если их нет
          if (!polygon.properties) {
            polygon.properties = {
              name: polygon.name || 'Регион',
              fillColor: polygon.fillColor || 'rgba(255,165,0,0.3)',
              strokeColor: polygon.strokeColor || '#ff6400'
            };
          }
          validFeatures.push(polygon);
        });
        
        // Создаем коллекцию геометрий из GeoJSON
        const features = new ol.format.GeoJSON().readFeatures({
          type: 'FeatureCollection',
          features: validFeatures
        }, {
          featureProjection: 'EPSG:3857'
        });
        
        // Устанавливаем свойства для каждого полигона
        features.forEach(feature => {
          const props = feature.getProperties();
          if (props.properties) {
            // Если свойства находятся в подобъекте properties (стандартный GeoJSON)
            feature.setProperties({
              name: props.properties.name,
              fillColor: props.properties.fillColor,
              strokeColor: props.properties.strokeColor
            });
          }
        });
        
        // Добавляем полигоны на карту
        regionsSource.addFeatures(features);
        
        // Центрируем карту на полигонах, если они есть
        if (features.length > 0) {
          const extent = regionsSource.getExtent();
          map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 500
          });
        }
      } catch (error) {
        console.error('Ошибка при загрузке полигонов:', error);
        
        // Резервный метод для полигонов в старом формате или в случае ошибки
        polygons.forEach(polygon => {
          try {
            if (polygon.type === 'Feature' && polygon.geometry) {
              let feature;
              if (polygon.geometry.type === 'Polygon' && polygon.geometry.coordinates) {
                // Создаем объект с геометрией в формате Polygon
                feature = new ol.Feature({
                  geometry: new ol.geom.Polygon(polygon.geometry.coordinates.map(ring => 
                    ring.map(coord => ol.proj.fromLonLat(coord))
                  )),
                  name: (polygon.properties && polygon.properties.name) || polygon.name || 'Неизвестный',
                  fillColor: (polygon.properties && polygon.properties.fillColor) || polygon.fillColor || 'rgba(255,165,0,0.3)',
                  strokeColor: (polygon.properties && polygon.properties.strokeColor) || polygon.strokeColor || '#ff6400'
                });
              } else if (polygon.geometry.type === 'MultiPolygon' && polygon.geometry.coordinates) {
                // Создаем объект с геометрией в формате MultiPolygon
                const multiPolygon = new ol.geom.MultiPolygon(polygon.geometry.coordinates.map(poly => 
                  poly.map(ring => 
                    ring.map(coord => ol.proj.fromLonLat(coord))
                  )
                ));
                feature = new ol.Feature({
                  geometry: multiPolygon,
                  name: (polygon.properties && polygon.properties.name) || polygon.name || 'Неизвестный',
                  fillColor: (polygon.properties && polygon.properties.fillColor) || polygon.fillColor || 'rgba(255,165,0,0.3)',
                  strokeColor: (polygon.properties && polygon.properties.strokeColor) || polygon.strokeColor || '#ff6400'
                });
              }
              
              if (feature) {
                regionsSource.addFeature(feature);
              }
            } else if (polygon.coordinates) {
              // Старый формат с прямым массивом координат
              const feature = new ol.Feature({
                geometry: new ol.geom.Polygon([polygon.coordinates.map(coord => ol.proj.fromLonLat(coord))]),
                name: polygon.name || 'Неизвестный',
                fillColor: polygon.fillColor || 'rgba(255,165,0,0.3)',
                strokeColor: polygon.strokeColor || '#ff6400'
              });
              
              regionsSource.addFeature(feature);
            }
          } catch (e) {
            console.error('Ошибка при добавлении полигона:', e, polygon);
          }
        });
      }
      
      // Устанавливаем название датасета только если элемент существует
      const currentDatasetNameElement = document.getElementById('current-dataset-name');
      if (currentDatasetNameElement && appData.datasets[datasetKey]) {
        currentDatasetNameElement.textContent = appData.datasets[datasetKey].name;
      }
    }
    
    // Загрузка точек для выбранного датасета
    function loadPinsForDataset(datasetKey) {
      pinsSource.clear();
      
      // НЕ загружаем все точки сразу - будем показывать их только при клике на регион
      // Обновляем название датасета только если элемент существует
      const currentDatasetNameElement = document.getElementById('current-dataset-name');
      if (currentDatasetNameElement && appData.datasets[datasetKey]) {
        currentDatasetNameElement.textContent = appData.datasets[datasetKey].name;
      }
    }
    
    // Показать точки для конкретного региона
    function showPinsForRegion(regionName) {
      pinsSource.clear();
      const datasetPins = appData.pins[currentDataset];
      if (!datasetPins) return;

      const regionPins = datasetPins[regionName];
      if (!regionPins) return;
      
      console.log('Показываем точки для региона:', regionName, '- количество:', regionPins.length);
      
      regionPins.forEach((item, index) => {
        // Создаем круглую иконку на основе фото
        createCircleIcon(item.photo, function(iconDataUrl) {
          const coords = item.coords || [item.lon, item.lat]; // Поддержка обоих форматов
          const feature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat(coords)),
            data: item,
            region: regionName,
            index: index
          });
          
          // Применяем стиль с иконкой
          feature.setStyle(new ol.style.Style({
            image: new ol.style.Icon({
              anchor: [0.5, 1],
              src: iconDataUrl,
              scale: 1.0 // Возвращаем нормальный размер
            })
          }));
          
          pinsSource.addFeature(feature);
        });
      });
    }
    
    // Инициализация селектора датасетов
    function initDatasetSelector() {
      const select = document.getElementById('dataset-select');
      select.innerHTML = '';
      
      // Добавляем опции для всех доступных датасетов
      Object.keys(appData.datasets).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = appData.datasets[key].name;
        if (key === currentDataset) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      
      // Обработчик изменения датасета
      select.onchange = function() {
        currentDataset = this.value;
        loadPolygonsForDataset(currentDataset);
      };
    }

    // Запуск приложения
    function init() {
      initDatasetSelector();
      loadPolygonsForDataset(currentDataset);
    }
    
    // Запускаем приложение
    init();
  </script>
</body>
</html>`;
}

// Экспорт данных в JSON-файл
function exportData() {
  const dataToExport = {
    currentDataset: appData.currentDataset,
    datasets: appData.datasets,
    polygons: appData.polygons,
    pins: appData.pins
  };
  
  const jsonString = JSON.stringify(dataToExport, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tatarstan-map-data.json';
  document.body.appendChild(a);
  a.click();
  
  setTimeout(function() {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
}

// Импорт данных из JSON-файла
function importData(file) {
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // Проверяем структуру данных
      if (!importedData.datasets || !importedData.polygons || !importedData.pins) {
        throw new Error('Неверный формат данных');
      }
      
      // Проверка на null или недопустимый currentDataset
      if (importedData.currentDataset === null || !importedData.datasets[importedData.currentDataset]) {
        console.warn('В импортируемых данных currentDataset равен null или недействителен');
        
        // Берем первый доступный датасет
        const datasetKeys = Object.keys(importedData.datasets);
        if (datasetKeys.length > 0) {
          importedData.currentDataset = datasetKeys[0];
          console.log('Установлен первый доступный датасет:', importedData.currentDataset);
        } else {
          throw new Error('В импортируемых данных нет ни одного датасета');
        }
      }
      
      // Миграция данных если нужно
      try {
        migrateDataFormat(importedData);
      } catch (migrationError) {
        console.error('Ошибка при миграции данных:', migrationError);
        // Продолжаем несмотря на ошибку, так как часть данных может быть импортирована
      }
      
      // Очищаем данные от "мусора" перед импортом
      cleanupData(importedData);
      
      // Применяем импортированные данные
      appData.currentDataset = importedData.currentDataset;
      appData.datasets = importedData.datasets;
      appData.polygons = importedData.polygons;
      appData.pins = importedData.pins;
      
      // Проверяем наличие структур для текущего датасета
      if (!appData.polygons[appData.currentDataset]) {
        appData.polygons[appData.currentDataset] = [];
        console.warn(`Инициализирован пустой массив полигонов для датасета ${appData.currentDataset}`);
      }
      
      if (!appData.pins[appData.currentDataset]) {
        appData.pins[appData.currentDataset] = {};
        console.warn(`Инициализирован пустой объект пинов для датасета ${appData.currentDataset}`);
      }
      
      // Инициализируем кэш иконок, если его нет
      if (!appData.iconCache) {
        appData.iconCache = {};
      }
      
      // Обновляем интерфейс
      updateDatasetList();
      updateRegionList();
      updatePointList();
      loadPolygonsForDataset(appData.currentDataset);
      pinsSource.clear();
      
      alert('Данные успешно импортированы');
    } catch (error) {
      console.error('Ошибка при импорте:', error);
      alert('Ошибка при импорте данных: ' + error.message);
    }
  };
  
  reader.readAsText(file);
}

// Функция для миграции данных из старого формата в новый
function migrateDataFormat(data) {
  console.log('Проверка и миграция формата данных...');
  
  // Миграция пинов: проверяем оба формата координат
  Object.keys(data.pins).forEach(datasetKey => {
    const dataset = data.pins[datasetKey];
    Object.keys(dataset).forEach(regionName => {
      const pins = dataset[regionName];
      pins.forEach(pin => {
        // Если есть coords, но нет lon/lat, добавляем их
        if (pin.coords && (!pin.lon || !pin.lat)) {
          pin.lon = pin.coords[0];
          pin.lat = pin.coords[1];
          console.log('Миграция: добавлены lon/lat для точки из coords');
        }
        // Если есть lon/lat, но нет coords, добавляем их
        if ((pin.lon !== undefined && pin.lat !== undefined) && !pin.coords) {
          pin.coords = [pin.lon, pin.lat];
          console.log('Миграция: добавлены coords для точки из lon/lat');
        }
      });
    });
  });
  
  // Миграция полигонов: проверяем GeoJSON формат
  Object.keys(data.polygons).forEach(datasetKey => {
    const polygons = data.polygons[datasetKey];
    polygons.forEach((polygon, index) => {
      // Если это не GeoJSON
      if (!polygon.type || !polygon.geometry) {
        console.log('Миграция: преобразование полигона в формат GeoJSON');
        
        // Проверяем, не является ли это уже мультиполигоном
        if (Array.isArray(polygon.coordinates) && polygon.coordinates.length > 0 && Array.isArray(polygon.coordinates[0]) && 
            Array.isArray(polygon.coordinates[0][0]) && polygon.coordinates[0][0].length === 2) {
          // Это похоже на стандартный полигон с массивом координат
          data.polygons[datasetKey][index] = {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [polygon.coordinates || []]
            },
            properties: {
              name: polygon.name,
              fillColor: polygon.fillColor || `rgba(255, 165, 0, 0.3)`,
              strokeColor: polygon.strokeColor || '#ff6400'
            }
          };
        } else {
          // Это может быть multiPolygon или другой случай
          console.log('Миграция: возможно структура MultiPolygon');
          try {
            data.polygons[datasetKey][index] = {
              type: 'Feature',
              geometry: {
                type: polygon.multiPolygon ? 'MultiPolygon' : 'Polygon',
                coordinates: polygon.multiPolygon ? polygon.coordinates : [polygon.coordinates || []]
              },
              properties: {
                name: polygon.name,
                fillColor: polygon.fillColor || `rgba(255, 165, 0, 0.3)`,
                strokeColor: polygon.strokeColor || '#ff6400'
              }
            };
          } catch (e) {
            console.error('Ошибка миграции полигона:', e);
            // Резервный вариант - создать простой полигон
            data.polygons[datasetKey][index] = {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[]]
              },
              properties: {
                name: polygon.name || 'Неизвестный регион',
                fillColor: polygon.fillColor || `rgba(255, 165, 0, 0.3)`,
                strokeColor: polygon.strokeColor || '#ff6400'
              }
            };
          }
        }
      } else if (polygon.type === 'Feature' && polygon.geometry) {
        // Если это уже GeoJSON, проверяем правильность структуры
        if (!polygon.properties) {
          console.log('Миграция: добавление свойств к GeoJSON Feature');
          polygon.properties = {
            name: polygon.name || 'Неизвестный регион',
            fillColor: polygon.fillColor || `rgba(255, 165, 0, 0.3)`,
            strokeColor: polygon.strokeColor || '#ff6400'
          };
        }
      }
    });
  });
  
  console.log('Миграция данных завершена');
}

// Инициализация приложения
function init() {
  initMap();
  initUI();
  updateDatasetList();
  updateRegionList();
  
  console.log('Инициализация списка регионов для точек...');
  console.log('Текущий датасет:', appData.currentDataset);
  
  // Устанавливаем текущий датасет в селект точек
  const pointDatasetSelect = document.getElementById('point-dataset-select');
  if (pointDatasetSelect) {
    pointDatasetSelect.value = appData.currentDataset;
    console.log('Установлен датасет в селект точек:', appData.currentDataset);
  }
  
  // Инициализируем селект регионов для точек в основной вкладке
  populateRegionSelect(appData.currentDataset, 'point-region-select');
  updatePointList();
  
  loadPolygonsForDataset(appData.currentDataset);
}

// Запуск приложения при загрузке страницы
window.addEventListener('DOMContentLoaded', init);

// Добавляем новую функцию для временного скрытия модального окна без его закрытия
function temporaryHideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

// Функция для возврата видимости модального окна
function restoreModalVisibility(modalId) {
  const modal = document.getElementById(modalId);
  if (modal && modal.style.display !== 'none') {
    modal.classList.add('show');
  }
}

// Функция для импорта координат из JSON формата overpass-turbo.eu
function importCoordinatesFromOverpassJSON(jsonData) {
  // Проверяем, что это GeoJSON от overpass-turbo
  if (!jsonData.features || !jsonData.features.length) {
    alert('Некорректный формат JSON или отсутствуют данные о границах');
    return;
  }
  
  // Берем первый полигон из набора
  const feature = jsonData.features[0];
  if (!feature.geometry || feature.geometry.type !== 'Polygon') {
    alert('В JSON не найден полигон. Убедитесь, что вы экспортировали данные как GeoJSON');
    return;
  }
  
  // Получаем координаты полигона
  const coordinates = feature.geometry.coordinates[0];
  
  // Очищаем существующие координаты
  const container = document.getElementById('coordinates-container');
  container.innerHTML = '';
  
  // Добавляем каждую координату в форму
  coordinates.forEach(function(coord) {
    // Убеждаемся, что координаты в правильном порядке [lon, lat]
    const lon = coord[0];
    const lat = coord[1];
    
    // Создаем новую пару полей для координат
    const pair = document.createElement('div');
    pair.className = 'coordinate-pair';
    pair.innerHTML = `
      <input type="number" step="0.0001" placeholder="Долгота" class="lon-input" value="${lon}" required>
      <input type="number" step="0.0001" placeholder="Широта" class="lat-input" value="${lat}" required>
      <button type="button" class="remove-coord-btn">-</button>
    `;
    
    // Добавляем обработчик для кнопки удаления
    pair.querySelector('.remove-coord-btn').addEventListener('click', function() {
      pair.remove();
    });
    
    // Добавляем пару координат в контейнер
    container.appendChild(pair);
  });
  
  // Если у полигона есть название, заполняем поле имени региона
  if (feature.properties && feature.properties.name) {
    // Убедимся, что имя в правильной кодировке
    let name = feature.properties.name;
    // Исправляем кодировку, если необходимо (бывают проблемы с кириллицей)
    if (name.startsWith('ÐÐ') || name.includes('Ñ')) {
      try {
        name = decodeURIComponent(escape(name));
      } catch (e) {
        console.warn('Не удалось декодировать название:', e);
      }
    }
    document.getElementById('region-name').value = name;
  }
  
  // Если у полигона есть название на русском, используем его
  if (feature.properties && feature.properties['name:ru']) {
    let nameRu = feature.properties['name:ru'];
    try {
      nameRu = decodeURIComponent(escape(nameRu));
    } catch (e) {
      console.warn('Не удалось декодировать русское название:', e);
    }
    document.getElementById('region-name').value = nameRu;
  }
  
  alert('Координаты успешно импортированы: ' + coordinates.length + ' точек');
}

// ... existing code ...
function saveData() {
  const data = {
    datasets: appData.datasets,
    polygons: appData.polygons,
    pins: appData.pins,
    currentDataset: appData.currentDataset
  };
  
  localStorage.setItem('mapEditorData', JSON.stringify(data));
  console.log('Данные успешно сохранены в localStorage');
}
// ... existing code ...

// ... existing code ...
// Функция для редактирования датасета
function editDataset(datasetKey) {
  // Получаем текущий датасет
  const dataset = appData.datasets[datasetKey];
  if (!dataset) {
    alert('Датасет не найден');
    return;
  }
  
  // Заполняем форму текущими данными
  document.getElementById('edit-dataset-key').value = datasetKey;
  document.getElementById('edit-dataset-name').value = dataset.name;
  
  // Отображаем модальное окно
  showModal('edit-dataset-modal');
}

// Обновление названия датасета
function updateDatasetName(datasetKey, newName) {
  if (!appData.datasets[datasetKey]) {
    alert('Датасет не найден');
    return false;
  }
  
  // Обновляем только название датасета
  appData.datasets[datasetKey].name = newName;
  
  // Обновляем интерфейс
  updateDatasetList();
  populateDatasetSelects();
  
  // Обновляем заголовок, если это текущий датасет
  if (appData.currentDataset === datasetKey) {
    const currentDatasetNameElement = document.getElementById('current-dataset-name');
    if (currentDatasetNameElement) {
      currentDatasetNameElement.textContent = newName;
    }
  }
  
  // Сохраняем изменения
  saveData();
  
  return true;
}
// ... existing code ...

// ... existing code ...
// Функция для импорта региона по OSM ID
function importRegionByOsmId(osmId, datasetKey, regionName, fillColor, fillOpacity, strokeColor) {
  // Показываем индикатор загрузки
  alert('Загрузка данных региона... Пожалуйста, подождите.');
  
  // Формируем URL для прямого получения GeoJSON полигона
  const geoJsonUrl = `https://polygons.openstreetmap.fr/get_geojson.py?id=${osmId}`;
  
  // Выполняем запрос к сервису
  fetch(geoJsonUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      return response.json();
    })
    .then(geoJson => {
      console.log('Получен GeoJSON:', geoJson);
      
      if (!geoJson || !geoJson.coordinates || geoJson.coordinates.length === 0) {
        throw new Error('Полученный GeoJSON не содержит данных о координатах');
      }
      
      // Создаем единый полигон вместо множества частей
      let polygonFeature;
      
      if (geoJson.type === 'Polygon') {
        // Один полигон - просто используем его как есть
        polygonFeature = createPolygonFeature(geoJson.coordinates, regionName, fillColor, fillOpacity, strokeColor);
      } 
      else if (geoJson.type === 'MultiPolygon') {
        // Для мультиполигона создаем один объект с типом MultiPolygon
        polygonFeature = createMultiPolygonFeature(geoJson.coordinates, regionName, fillColor, fillOpacity, strokeColor);
      }
      else {
        throw new Error(`Неподдерживаемый тип геометрии: ${geoJson.type}`);
      }
      
      console.log('Создан полигон:', polygonFeature);
      
      // Добавляем полигон в датасет
      if (!appData.polygons[datasetKey]) {
        appData.polygons[datasetKey] = [];
      }
      
      appData.polygons[datasetKey].push(polygonFeature);
      
      // Сохраняем данные
      saveData();
      
      // Обновляем список регионов
      updateRegionList();
      
      // Перезагружаем полигоны на карте
      loadPolygonsForDataset(datasetKey);
      
      alert(`Регион "${regionName}" успешно импортирован!`);
    })
    .catch(error => {
      console.error('Ошибка при импорте региона:', error);
      alert(`Ошибка при импорте региона: ${error.message}`);
    });
}

// Вспомогательная функция для создания полигона из координат
function createPolygonFeature(coordinates, name, fillColor, fillOpacity, strokeColor) {
  return {
    type: 'Feature',
    properties: {
      name: name,
      fillColor: fillColor,
      fillOpacity: fillOpacity,
      strokeColor: strokeColor
    },
    geometry: {
      type: 'Polygon',
      coordinates: coordinates
    }
  };
}

// Вспомогательная функция для создания мультиполигона
function createMultiPolygonFeature(coordinates, name, fillColor, fillOpacity, strokeColor) {
  return {
    type: 'Feature',
    properties: {
      name: name,
      fillColor: fillColor,
      fillOpacity: fillOpacity,
      strokeColor: strokeColor
    },
    geometry: {
      type: 'MultiPolygon',
      coordinates: coordinates
    }
  };
}

// Функция для получения названия региона из OSM
function fetchOsmRegionName(osmId) {
  // Формируем запрос к Overpass API для получения информации о регионе
  const overpassQuery = `
    [out:json];
    relation(${osmId});
    out tags;
  `;
  
  // URL-кодируем запрос
  const encodedQuery = encodeURIComponent(overpassQuery);
  
  // Формируем URL для запроса к Overpass API
  const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodedQuery}`;
  
  // Показываем, что идет загрузка
  const nameInput = document.getElementById('import-region-name');
  nameInput.placeholder = 'Загрузка...';
  
  // Выполняем запрос к Overpass API
  fetch(overpassUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('Не удалось получить данные от Overpass API');
      }
      return response.json();
    })
    .then(data => {
      // Проверяем, что получены данные для отношения
      if (!data.elements || data.elements.length === 0) {
        nameInput.placeholder = 'Регион не найден';
        return;
      }
      
      const relation = data.elements[0];
      const tags = relation.tags;
      
      // Ищем название на нужных языках (приоритет: русский, английский, любое)
      let name = tags['name:ru'] || tags['name'] || tags['name:en'];
      
      if (name) {
        nameInput.value = name;
      } else {
        nameInput.placeholder = 'Название не найдено';
      }
    })
    .catch(error => {
      console.error('Ошибка при получении названия региона:', error);
      nameInput.placeholder = 'Ошибка загрузки';
    });
}

// Вспомогательная функция для добавления точек полигона в форму
function addPolygonPointsToForm(coords, container) {
  // Проходим по всем координатам, кроме последней (она дублирует первую для замкнутого полигона)
  for (let i = 0; i < coords.length - 1; i++) {
    const coord = coords[i];
    
    const pair = document.createElement('div');
    pair.className = 'coordinate-pair';
    pair.innerHTML = `
      <input type="number" step="0.0001" placeholder="Долгота" class="lon-input" value="${coord[0].toFixed(6)}" required>
      <input type="number" step="0.0001" placeholder="Широта" class="lat-input" value="${coord[1].toFixed(6)}" required>
      <button type="button" class="remove-coord-btn">-</button>
    `;
    container.appendChild(pair);
  }
}

// Функция для очистки данных от несуществующих регионов и точек
function cleanupData(data) {
  console.log('Очистка данных перед экспортом...');
  
  // Получаем список всех датасетов
  const datasetKeys = Object.keys(data.datasets);
  
  // Очищаем данные полигонов (регионов) - оставляем только те, что относятся к существующим датасетам
  Object.keys(data.polygons).forEach(datasetKey => {
    if (!datasetKeys.includes(datasetKey)) {
      console.log(`Удален набор полигонов для несуществующего датасета: ${datasetKey}`);
      delete data.polygons[datasetKey];
    }
  });
  
  // Очищаем данные пинов (точек) - оставляем только те, что относятся к существующим датасетам
  Object.keys(data.pins).forEach(datasetKey => {
    if (!datasetKeys.includes(datasetKey)) {
      console.log(`Удален набор пинов для несуществующего датасета: ${datasetKey}`);
      delete data.pins[datasetKey];
    } else {
      // Также очищаем пины для несуществующих регионов
      // Для каждого датасета получаем имена всех его регионов
      const regionNames = data.polygons[datasetKey] 
        ? data.polygons[datasetKey].map(polygon => polygon.properties.name)
        : [];
      
      // Проверяем каждый регион в пинах
      Object.keys(data.pins[datasetKey]).forEach(regionName => {
        if (!regionNames.includes(regionName)) {
          console.log(`Удалены пины для несуществующего региона: ${regionName} в датасете ${datasetKey}`);
          delete data.pins[datasetKey][regionName];
        }
      });
    }
  });
  
  // Проверяем, что текущий датасет существует
  if (!datasetKeys.includes(data.currentDataset)) {
    console.log(`Текущий датасет не найден: ${data.currentDataset}, выбираем первый доступный`);
    data.currentDataset = datasetKeys.length > 0 ? datasetKeys[0] : null;
  }
  
  console.log('Очистка данных завершена');
  return data;
}
