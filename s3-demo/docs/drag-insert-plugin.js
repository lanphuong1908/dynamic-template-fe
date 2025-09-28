(function (window, undefined) {
  window.Asc.plugin.init = function () {
    window.addEventListener('message', function (event) {
      if (event.origin !== window.parent.origin) return;
      if (event.data.type === 'insertItem') {
        var data = event.data.data;
        var sdk = window.Asc.scope.sdk || window.Asc.plugin;

        try {
          switch (data.type) {
            case 'text':
              sdk.executeMethod('InsertText', [data.content, false]);
              break;
            case 'image':
              sdk.executeMethod('AddImage', [data.src]);
              break;
            default:
              console.log('Unsupported type:', data.type);
          }
        } catch (error) {
          console.error('Plugin error:', error);
        }
      }
    });
  };

  window.Asc.plugin.button = function () {
    this.executeCommand('close', '');
  };

  window.Asc.plugin.onTranslate = function () {
    return false;
  };
})(window);