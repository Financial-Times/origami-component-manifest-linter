/* eslint-env mocha */
/* global proclaim sinon */
import * as fixtures from './helpers/fixtures';
import DefaultTemplate from '../../main';

describe("DefaultTemplate", () => {
	it('is defined', () => {
		proclaim.equal(typeof DefaultTemplate, 'function');
	});

	it('has a static init method', () => {
		proclaim.equal(typeof DefaultTemplate.init, 'function');
	});

	it("should autoinitialize", (done) => {
		const initSpy = sinon.spy(DefaultTemplate, 'init');
		document.dispatchEvent(new CustomEvent('o.DOMContentLoaded'));
		setTimeout(function(){
			proclaim.equal(initSpy.called, true);
			initSpy.restore();
			done();
		}, 100);
	});

	it("should not autoinitialize when the event is not dispached", () => {
		const initSpy = sinon.spy(DefaultTemplate, 'init');
		proclaim.equal(initSpy.called, false);
	});

	describe("should create a new default-template", () => {

		beforeEach(() => {
			fixtures.htmlCode();
		});

		afterEach(() => {
			fixtures.reset();
		});

		it("component array when initialized", () => {
			const boilerplate = DefaultTemplate.init();
			proclaim.equal(boilerplate instanceof Array, true);
			proclaim.equal(boilerplate[0] instanceof DefaultTemplate, true);
		});

		it("single component when initialized with a root element", () => {
			const boilerplate = DefaultTemplate.init('#element');
			proclaim.equal(boilerplate instanceof DefaultTemplate, true);
		});
	});
});