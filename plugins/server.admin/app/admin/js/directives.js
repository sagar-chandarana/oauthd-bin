hooks.config.push(function() {
  app.directive('bootstrapModal', function() {
    return {
      restrict: 'A',
      scope: false,
      link: function($scope, tElement, tAttrs, Ctrl) {
        $scope.$on('btShow', function() {
          return $(tElement).modal('show');
        });
        return $scope.$on('btHide', function() {
          return $(tElement).modal('hide');
        });
      }
    };
  });
  return app.directive('lightbox', function($timeout) {
    return {
      restrict: 'A',
      scope: false,
      template: '<div class="modal">\
	<div class="modal-dialog">\
		<div class="modal-content">\
			<div class="modal-body">\
				<img ng-src="{{baseurl}}/{{lightbox.img}}" id="lightbox-img">\
			</div>\
			<div class="modal-footer">\
				<p style="text-align: center" class="caption" id="lightbox-caption">{{lightbox.caption}}</p>\
			</div>\
		</div>\
	</div>\
</div>',
      link: function($scope, tElement, tAttrs, Ctrl) {
        $scope.lightbox = {
          show: false,
          img: "",
          caption: "",
          debug: false
        };
        $scope.showLightbox = function(img, caption) {
          $(tElement).modal('show').find('.modal').show();
          $('.modal-backdrop').css('opacity', 0.5);
          $scope.lightbox.show = true;
          $scope.lightbox.img = img;
          $scope.lightbox.caption = caption;
          return $scope.lightbox.debug = true;
        };
        return $('body').click(function() {
          if ($scope.lightbox.debug === true) {
            return $scope.lightbox.debug = false;
          } else {
            if ($scope.lightbox.show) {
              $(tElement).modal('hide').find('.modal').hide();
              return $('.modal-backdrop').remove();
            }
          }
        });
      }
    };
  });
});
