/**
 * Обработчик формы датасета
 */
document.addEventListener('DOMContentLoaded', function() {
  // Форма датасета
  const form = document.getElementById('dataset-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('Отправка формы датасета');
      
      const key = document.getElementById('dataset-key').value;
      const name = document.getElementById('dataset-name').value;
      
      try {
        addDataset(key, name);
        updateDatasetList();
        hideModal('dataset-modal');
        this.reset();
      } catch (error) {
        alert(error.message);
      }
    });
    console.log('Обработчик формы датасета зарегистрирован');
  } else {
    console.error('Форма датасета не найдена в DOM');
  }
}); 