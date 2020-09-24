class DefaultTemplate {
	/**
	 * Class constructor.
	 * @param {HTMLElement} [defaultTemplateEl] - The component element in the DOM
	 * @param {Object} [options={}] - An options object for configuring the component
	 */
	constructor (defaultTemplateEl, options) {
		this.defaultTemplateEl = defaultTemplateEl;
		this.options = Object.assign({}, {
		}, options || DefaultTemplate.getDataAttributes(defaultTemplateEl));
	}
	/**
	 * Get the data attributes from the DefaultTemplateElement. If the element is being set up
	 * declaratively, this method is used to extract the data attributes from the DOM.
	 * @param {HTMLElement} defaultTemplateEl - The component element in the DOM
	 * @returns {Object} An options object which can be used for configuring the component
	 */
	static getDataAttributes (defaultTemplateEl) {
		if (!(defaultTemplateEl instanceof HTMLElement)) {
			return {};
		}
		return Object.keys(defaultTemplateEl.dataset).reduce((options, key) => {
			// Ignore data-o-component
			if (key === 'oComponent') {
				return options;
			}
			// Build a concise key and get the option value
			const shortKey = key.replace(/^defaultTemplate(\w)(\w+)$/, (m, m1, m2) => m1.toLowerCase() + m2);
			const value = defaultTemplateEl.dataset[key];
			// Try parsing the value as JSON, otherwise just set it as a string
			try {
				options[shortKey] = JSON.parse(value.replace(/'/g, '"'));
			} catch (error) {
				options[shortKey] = value;
			}
			return options;
		}, {});
	}
	/**
	 * Initialise default-template component/s.
	 * @param {(HTMLElement|String)} rootElement - The root element to intialise the component in, or a CSS selector for the root element
	 * @param {Object} [options={}] - An options object for configuring the component
	 * @returns {DefaultTemplate|DefaultTemplate[]} The newly constructed DefaultTemplate components
	 */
	static init (rootElement, options) {
		if (!rootElement) {
			rootElement = document.body;
		}
		if (!(rootElement instanceof HTMLElement)) {
			rootElement = document.querySelector(rootElement);
		}
		if (rootElement instanceof HTMLElement && rootElement.matches('[data-o-component=default-template]')) {
			return new DefaultTemplate(rootElement, options);
		}
		return Array.from(rootElement.querySelectorAll('[data-o-component="default-template"]'), rootEl => new DefaultTemplate(rootEl, options));
	}
}

export default DefaultTemplate;