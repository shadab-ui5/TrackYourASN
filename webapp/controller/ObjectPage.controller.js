sap.ui.define([
    'sap/ui/core/mvc/Controller',
    'sap/ui/model/json/JSONModel',
    'sap/m/MessageBox',
    'sap/ui/model/Filter',
    'hodek/asntracker/utils/Formatter',
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, Filter, Formatter, FilterOperator,MessageToast) {
    "use strict";

    return Controller.extend("hodek.asntracker.controller.ObjectPage", {
        formatter: Formatter,

        onInit: function () {
            this.baseObjectStoreUrl = "https://hodek-vibration-technologies-pvt-ltd-dev-hodek-eklefds556845713.cfapps.us10-001.hana.ondemand.com/odata/v4/object-store";
            this.getView().setModel(new JSONModel([]), "files");

            var sAsnDetailModel = new sap.ui.model.json.JSONModel([]);
            this.getOwnerComponent().setModel(sAsnDetailModel, "AsnDetailModel");
            let oModel = this.getOwnerComponent().getModel('selectedModel');
            if (!oModel) {
                this.getOwnerComponent().getRouter().navTo("RouteMain", {
                }, true);
                return;
            }
            this.getView().setModel(oModel, 'selectedModel');
            console.log(oModel.getData())
            console.log(this.getView().getModel('selectedModel').getData());
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteObject").attachPatternMatched(this._onRouteMatched, this);
        },
        _showMessage: function (sText, sType) {
            var oVBox = this.byId("messageBox");
            if (!oVBox) {
                return; // fallback: no container
            }

            // clear old messages
            oVBox.removeAllItems();

            // create message strip dynamically
            var oMessageStrip = new sap.m.MessageStrip({
                text: sText,
                type: sType || "Information",   // default type if not passed
                showIcon: true,
                showCloseButton: true
            });

            oVBox.addItem(oMessageStrip);
        },


        _onRouteMatched: function (oEvent) {
            let oModel = this.getView().getModel('selectedModel');
            this.refreshFiles();
            if (!oModel) {
                this.getOwnerComponent().getRouter().navTo("RouteMain", {
                }, true);
                return;
            }
            this.getView().setBusy(true);
            this._loadItemDetails(oModel.getData()['AsnNo']);
            console.log(this.getView().getModel('selectedModel').getData());
        },
        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteMain", {}, true); // replace with actual route
        },
        _loadItemDetails: function (sAsn) {
            var oModel = this.getOwnerComponent().getModel(); // OData Model
            var that = this;

            var aFilters = [
                new Filter("AsnNo", FilterOperator.EQ, sAsn)
            ];

            oModel.read("/Item", {
                filters: aFilters,
                success: function (oData) {
                    if (oData.results && oData.results.length > 0) {
                        that.getView().getModel("AsnDetailModel").setData(oData.results);
                        that._showMessage("ASN item data loaded!", "Success");
                        that.getView().getModel("AsnDetailModel").refresh();
                    } else {
                        that._showMessage("No records found for given criteria", "Warning");
                        MessageBox.warning("No data found for Billing Document: " + sAsn);
                    }
                    that.getView().setBusy(false);
                },
                error: function (oError) {
                    that.getView().setBusy(false);
                    that._showMessage("Error fetching Asn data!", "Error");
                    MessageBox.error("Error fetching Asn data");
                    console.log("OData Error:", oError);
                }
            });
        },
        /** 🔹 Formatter - file size */
        formatSize: function (iSize) {
            if (!iSize) return "0 KB";
            let sUnit = "Bytes";
            let iCalc = iSize;

            if (iSize > 1024) {
                iCalc = (iSize / 1024).toFixed(1);
                sUnit = "KB";
            }
            if (iSize > 1024 * 1024) {
                iCalc = (iSize / (1024 * 1024)).toFixed(1);
                sUnit = "MB";
            }
            return iCalc + " " + sUnit;
        },

        /** 🔹 Formatter - icon based on MIME type */
        getIconSrc: function (sFileName) {
            if (sFileName) {
                const sExt = sFileName.split(".").pop().toLowerCase();
                if (sExt === "pdf") return "sap-icon://pdf-attachment";
                if (["png", "jpg", "jpeg"].includes(sExt)) return "sap-icon://attachment-photo";
                return "sap-icon://document";
            }
            return "sap-icon://document";
        },
        refreshFiles: async function () {
            let url = this.baseObjectStoreUrl + "/listFiles";
            let folderName = this.getView().getModel("selectedModel").getProperty("/AsnNo");
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folder: folderName })
            });
            const data = await res.json();
            this.getView().getModel("files").setData(data.value || []);
        },

        onUpload: function () {
            const that = this;
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.onchange = async function (e) {
                const file = e.target.files[0];
                if (!file) return;

                const arrayBuffer = await file.arrayBuffer();
                const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

                const res = await fetch(that.baseObjectStoreUrl + "/uploadFile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ objectName: file.name, content: base64 })
                });

                const result = await res.json();
                MessageToast.show(result.value || "Uploaded");
                that.refreshFiles();
            };
            fileInput.click();
        },

        onDownload: async function () {
            const table = this.byId("fileTable");
            const selected = table.getSelectedItem();
            if (!selected) {
                MessageToast.show("Select a file to download");
                return;
            }

            const objectName = selected.getBindingContext("files").getObject().objectName;
            const res = await fetch(this.baseObjectStoreUrl + "/downloadFile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ objectName })
            });
            const data = await res.json();

            const byteCharacters = atob(data.content);
            const byteNumbers = Array.from(byteCharacters).map(c => c.charCodeAt(0));
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray]);
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = data.objectName;
            a.click();
            URL.revokeObjectURL(url);
        },

        onDelete: async function () {
            const table = this.byId("fileTable");
            const selected = table.getSelectedItem();
            if (!selected) return;

            const objectName = selected.getBindingContext("files").getObject().objectName;
            const res = await fetch(this.baseObjectStoreUrl + "/deleteFile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ objectName })
            });
            const result = await res.json();

            MessageToast.show(result.value || "Deleted");
            this.refreshFiles();
        },
        onFileSelect: function (oEvent) {
            const oTable = oEvent.getSource();
            const aSelectedContexts = oTable.getSelectedContexts("files"); // or your model name

            const bHasSelection = aSelectedContexts.length > 0;
            this.getView().getModel('selectedModel').setProperty('/activeDownload',bHasSelection)
        },
        getFileName: function (sObjectName) {
            if (!sObjectName) return "";
            const idx = sObjectName.indexOf("/");
            return idx > -1 ? sObjectName.substring(idx + 1) : sObjectName;
        }

    });
});