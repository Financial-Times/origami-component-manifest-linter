import defaultTemplate from './src/js/default-template';
const constructAll = function () {
	defaultTemplate.init();
	document.removeEventListener('o.DOMContentLoaded', constructAll);
};
document.addEventListener('o.DOMContentLoaded', constructAll);
export default defaultTemplate;