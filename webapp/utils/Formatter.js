sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
],
    function (JSONModel, Device) {
        "use strict";

        return {
            /**
             * Provides runtime information for the device the UI5 app is running on as a JSONModel.
             * @returns {sap.ui.model.json.JSONModel} The device model.
             */
            formatDateToYyyyMmDd: function (oDate) {
                if (!oDate) return;
                const year = oDate.getFullYear();
                const month = String(oDate.getMonth() + 1).padStart(2, '0');
                const day = String(oDate.getDate()).padStart(2, '0');
                return `${day}-${month}-${year}`; // e.g. "2025-08-07"
            },
            formatIcon: function (sStatus) {
                switch (sStatus) {
                    case "ASN Created":
                        return "sap-icon://information"; // yellow icon
                    case "ASN Cancelled":
                        return "sap-icon://cancel"; // red
                    case "Gate Entry Completed":
                        return "sap-icon://inventory"; // green
                    case "Goods Receipt Rejected":
                        return "sap-icon://error"; // red
                    case "Goods Receipt Accepted":
                        return "sap-icon://sys-enter"; // green
                    case "Invoice Posted for Payment":
                        return "sap-icon://payment-approval"; // green
                    default:
                        return "sap-icon://question-mark";
                }
            },

            // 2. Format state based on status
            formatState: function (sStatus) {
                switch (sStatus) {
                    case "ASN Created":
                        return "Information"; // Yellow
                    case "ASN Cancelled":
                        return "Warning"; // Red
                    case "Gate Entry Completed":
                        return "Indication06"; // blue
                    case "Goods Receipt Rejected":
                        return "Error"; // Red
                    case "Goods Receipt Accepted":
                        return "Success"; // Green
                    case "Invoice Posted for Payment":
                        return "Indication07"; // Green
                    default:
                        return "None";
                }
            },
            formatDateToDDMMYYYY: function (oDate) {
                if (!oDate) return "";

                const date = new Date(oDate);
                const dd = String(date.getDate()).padStart(2, '0');
                const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
                const yyyy = date.getFullYear();

                return `${dd}-${mm}-${yyyy}`;
            },
            formatStatusText: function (oRow) {
                if (!oRow) return "";
                // Rule 4: Status = "01" means CAPA required
                if (oRow.Status === "01") {
                    return "Failed. 8D CAPA Required";
                }
                // Rule 1: Pending
                if ((+oRow.InspectionLotOKQty || 0) === 0 && (+oRow.InspectionLotNOTOKQty || 0) === 0) {
                    return "Pending";
                }

                // Rule 2: Passed
                if ((+oRow.Postedquantity || 0) === (+oRow.InspectionLotOKQty || 0) && (+oRow.InspectionLotNOTOKQty || 0) === 0) {
                    return "Passed";
                }
                if ((+oRow.Postedquantity || 0) > (+oRow.InspectionLotOKQty + (+oRow.InspectionLotNOTOKQty) || 0) && (+oRow.InspectionLotNOTOKQty || 0) === 0) {
                    return "Passed,Short Goods Receipt";
                }

                // Rule 3: Failed if NOT OK > 0
                if ((+oRow.InspectionLotNOTOKQty || 0) > 0) {
                    return "Failed";
                }

                return "Lo";
            },

            formatStatusState: function (oRow) {
                if (!oRow) return "None";

                if ((+oRow.InspectionLotOKQty || 0) === 0 && (+oRow.InspectionLotNOTOKQty || 0) === 0) {
                    return "Warning"; // Yellow
                }
                if ((+oRow.Postedquantity || 0) === (+oRow.InspectionLotOKQty || 0) && (+oRow.InspectionLotNOTOKQty || 0) === 0) {
                    return "Success"; // Green
                }

                if ((+oRow.Postedquantity || 0) > (+oRow.InspectionLotOKQty + (+oRow.InspectionLotNOTOKQty) || 0) && (+oRow.InspectionLotNOTOKQty || 0) === 0) {
                    return "Indication06";
                }

                if ((+oRow.InspectionLotNOTOKQty || 0) > 0 || oRow.Status === "01") {
                    return "Error"; // Red
                }

                return "None";
            },

            formatStatusIcon: function (oRow) {
                if (!oRow) return "";

                if ((+oRow.InspectionLotOKQty || 0) === 0 && (+oRow.InspectionLotNOTOKQty || 0) === 0) {
                    return "sap-icon://pending";
                }
                if ((+oRow.Postedquantity || 0) === (+oRow.InspectionLotOKQty || 0) && (+oRow.InspectionLotNOTOKQty || 0) === 0) {
                    return "sap-icon://accept";
                }
                if ((+oRow.Postedquantity || 0) > (+oRow.InspectionLotOKQty + (+oRow.InspectionLotNOTOKQty) || 0) && (+oRow.InspectionLotNOTOKQty || 0) === 0) {
                    return "sap-icon://add-activity-2";
                }
                if ((+oRow.InspectionLotNOTOKQty || 0) > 0 || oRow.Status === "01") {
                    return "sap-icon://error";
                }

                return "";
            }
        };

    });