// Customize EventTarget's addEventListener to include passive event listeners where appropriate
(function() {
    var originalAddEventListener = EventTarget.prototype.addEventListener;

    EventTarget.prototype.addEventListener = function(type, listener, options) {
        var isPassiveEvent = ['scroll', 'wheel', 'touchstart', 'touchmove'].includes(type);
        var passiveOptions = isPassiveEvent ? { passive: true, capture: false } : {};
        options = typeof options === 'boolean' ? { capture: options } : options || {};
        if (isPassiveEvent && !options.passive) {
            options = Object.assign({}, options, passiveOptions);
        }
        originalAddEventListener.call(this, type, listener, options);
    };
})();

// Wait for FlexSlider to initialize, then modify event listeners
jQuery(document).ready(function() {
    jQuery('.flexslider').each(function() {
        var $slider = jQuery(this);
        $slider.flexslider({
            start: function(slider) {
                var el = slider.slides[0]; // Assuming slides are what FlexSlider binds touch events to
                // Remove and re-add touch event listeners with {passive: true}
                ['touchstart', 'touchmove'].forEach(function(eventType) {
                    el.removeEventListener(eventType, slider.vars[eventType], false);
                    el.addEventListener(eventType, slider.vars[eventType], {passive: true});
                });
            }
        });
    });
});
