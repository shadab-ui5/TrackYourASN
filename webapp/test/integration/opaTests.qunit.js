/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["hodek/asntracker/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
