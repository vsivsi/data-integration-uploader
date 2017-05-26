$('.upload-btn').on('click', function () {
    $('#parse-status').text('');
    setPanelStatus($("#status-panel"), 'panel-primary');
    $('#upload-input').click();
    $('.progress-bar').text('0%');
    $('.progress-bar').width('0%');
});

function resetFormElement(e) {
  e.wrap('<form>').closest('form').get(0).reset();
  e.unwrap();
}

function setPanelStatus($el, newClass) {
  const classes = ['panel-primary', 'panel-success', 'panel-info', 'panel-warning', 'panel-danger'];
  classes.filter(c => c !== newClass).forEach(c => $el.removeClass(c));
  $el.addClass(newClass);
}

$('#upload-input').on('change', function() {
  var files = $(this).get(0).files;

  if (files.length > 0){
    // create a FormData object which will be sent as the data payload in the
    // AJAX request
    var formData = new FormData();

    // loop through all the selected files and add them to the formData object
    for (var i = 0; i < files.length; i++) {
      var file = files[i];

      // add the files to formData object for the data payload
      formData.append('datafile', file, file.name);
    }

    $.ajax({
      url: '/upload',
      type: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      success: function(data){
        console.log('uploaded!\n' + data);
        // Print result
        $("#parsing-loader").hide();
        if ($.trim(data).match(/^Success/)) {
          setPanelStatus($("#status-panel"), 'panel-success');
          $("#parse-status").text('File upload and validation successful');
        } else {
          setPanelStatus($("#status-panel"), 'panel-danger');
          $("#parse-status").text(data);
        }

        // Clear form so 'change' with same file trigger new upload
        $('#upload-input').wrap('<form>').closest('form').get(0).reset();
        $('#upload-input').unwrap();
      },
      xhr: function() {
        // create an XMLHttpRequest
        var xhr = new XMLHttpRequest();

        // listen to the 'progress' event
        xhr.upload.addEventListener('progress', function(evt) {

          if (evt.lengthComputable) {
            // calculate the percentage of upload completed
            var percentComplete = evt.loaded / evt.total;
            percentComplete = parseInt(percentComplete * 100);

            // update the Bootstrap progress bar with the new percentage
            $('.progress-bar').text(percentComplete + '%');
            $('.progress-bar').width(percentComplete + '%');

            // once the upload reaches 100%, set the progress bar text to done
            if (percentComplete === 100) {
              $('.progress-bar').html('Done');
              setPanelStatus($("#status-panel"), 'panel-warning');
              $("#parsing-loader").show();
            }
          }
        }, false);

        return xhr;
      }
    });

  }
});
