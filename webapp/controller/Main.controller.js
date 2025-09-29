sap.ui.define([
	'sap/ui/core/mvc/Controller',
	'sap/ui/model/json/JSONModel',
	'sap/m/p13n/Engine',
	'sap/m/p13n/SelectionController',
	'sap/m/p13n/SortController',
	'sap/m/p13n/GroupController',
	'sap/m/p13n/FilterController',
	'sap/m/p13n/MetadataHelper',
	'sap/ui/model/Sorter',
	'sap/m/ColumnListItem',
	'sap/m/Text',
	'sap/ui/core/library',
	'sap/m/table/ColumnWidthController',
	'sap/ui/model/Filter',
	'hodek/asntracker/utils/Formatter',
	'sap/m/MessageBox',
	"sap/ui/core/format/DateFormat",
	"sap/ui/comp/valuehelpdialog/ValueHelpDialog",
], function (Controller, JSONModel, Engine, SelectionController, SortController, GroupController, FilterController, MetadataHelper, Sorter, ColumnListItem, Text, coreLibrary, ColumnWidthController, Filter, Formatter, MessageBox, DateFormat, ValueHelpDialog) {
	"use strict";

	return Controller.extend("hodek.asntracker.controller.Main", {

		onInit: function () {
			// this.onSet7DaysRange();
			// In onInit
			this._iPageSize = 100;       // number of items per batch
			this._iPage = 0;            // current page index
			this._bAllDataLoaded = false;
			this._bSkipFirstUpdate = false;  // skip the first updateStarted
			var oJsonModel = new sap.ui.model.json.JSONModel([]);
			this.getOwnerComponent().setModel(oJsonModel, "getListReport");
			var oSelectedModel = new sap.ui.model.json.JSONModel([]);
			this.getOwnerComponent().setModel(oSelectedModel, "selectedModel");
			this._registerForP13n();
			// this.onFilterGo();
			this._aCurrentFilters = [];

			this._loadBillingDocumentData(null, true);
			const oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("RouteMain").attachPatternMatched(this._onRouteMatched, this);

		},
		_onRouteMatched: function (oEvent) {
			if (this._iPage !== 0) {
				this.getView().setBusy(false);
			} else {
				this.getView().setBusy(true);
			}
		},
		formatter: Formatter,
		onSet7DaysRange: function () {
			var oDateRange = this.byId("idPostingDate");
			if (!oDateRange) {
				return;
			}

			// Today
			var oToday = new Date();

			// 7 days later
			var oNext7 = new Date();
			oNext7.setDate(oToday.getDate() + 7);

			// Set the range
			oDateRange.setDateValue(oToday);
			oDateRange.setSecondDateValue(oNext7);
		},
		_registerForP13n: function () {
			const oTable = this.byId("persoTable");

			this.oMetadataHelper = new MetadataHelper([
				// Newly added visible fields
				{
					key: "AsnNo_col",
					label: "ASN No",
					path: "AsnNo"
				},
				{
					key: "invoice_no_col",
					label: "Invoice No",
					path: "invoice_no"
				},
				{
					key: "invoice_date_col",
					label: "Invoice Date",
					path: "invoice_date"
				},
				{
					key: "ponumber_col",
					label: "PO Number",
					path: "ponumber"
				},
				{
					key: "Status_Desc_col",
					label: "Status Description",
					path: "Status_Desc"
				},



				// Hidden fields (can be enabled later in personalization)
				{
					key: "PlantName_col",
					label: "Plant Name",
					path: "PlantName"
				},
				{
					key: "amount_col",
					label: "Amount",
					path: "amount"
				},
			]);


			Engine.getInstance().register(oTable, {
				helper: this.oMetadataHelper,
				controller: {
					Columns: new SelectionController({
						targetAggregation: "columns",
						control: oTable
					}),
					Sorter: new SortController({
						control: oTable
					}),
					Groups: new GroupController({
						control: oTable
					}),
					ColumnWidth: new ColumnWidthController({
						control: oTable
					}),
					Filter: new FilterController({
						control: oTable
					})
				}
			});

			Engine.getInstance().attachStateChange(this.handleStateChange, this);
		},

		openPersoDialog: function (oEvt) {
			this._openPersoDialog(["Columns", "Sorter", "Groups", "Filter"], oEvt.getSource());
		},

		_openPersoDialog: function (aPanels, oSource) {
			var oTable = this.byId("persoTable");

			Engine.getInstance().show(oTable, aPanels, {
				contentHeight: aPanels.length > 1 ? "50rem" : "35rem",
				contentWidth: aPanels.length > 1 ? "45rem" : "32rem",
				source: oSource || oTable
			});
		},

		_getKey: function (oControl) {
			return oControl.data("p13nKey");
		},

		handleStateChange: function (oEvt) {
			const oTable = this.byId("persoTable");
			const oState = oEvt.getParameter("state");
			let that = this;
			if (!oState) {
				return;
			}

			//Update the columns per selection in the state
			this.updateColumns(oState);

			//Create Filters & Sorters
			const aFilter = this.createFilters(oState);
			const aGroups = this.createGroups(oState);
			const aSorter = this.createSorters(oState, aGroups);

			const aCells = oState.Columns.map(function (oColumnState) {
				const oProperty = this.oMetadataHelper.getProperty(oColumnState.key);

				switch (oColumnState.key) {
					case "invoice_date_col":   // format invoice date
						return new sap.m.Text({
							text: {
								path: "getListReport>" + oProperty.path,
								formatter: that.formatter.formatDateToYyyyMmDd
							}
						});

					case "Status_Desc_col":   // format with ObjectStatus
						return new sap.m.ObjectStatus({
							text: "{getListReport>Status_Desc}",
							icon: {
								path: "getListReport>Status_Desc",
								formatter: that.formatter.formatIcon
							},
							state: {
								path: "getListReport>Status_Desc",
								formatter: that.formatter.formatState
							}
						});

					case "PlantName_col":   // custom concat PlantName (Plant)
						return new sap.m.Text({
							text: {
								parts: [
									{ path: "getListReport>PlantName" },
									{ path: "getListReport>plant" }
								],
								formatter: function (sName, sPlant) {
									return sName && sPlant ? `${sName} (${sPlant})` : sName || sPlant || "";
								}
							}
						});

					default:   // default plain text binding
						return new sap.m.Text({
							text: "{getListReport>" + oProperty.path + "}"
						});
				}
			}.bind(this));


			//rebind the table with the updated cell template
			oTable.bindItems({
				templateShareable: false,
				path: 'getListReport>/',
				sorter: aSorter.concat(aGroups),
				filters: aFilter,
				template: new ColumnListItem({
					cells: aCells,
					vAlign: "Middle",
					type: "Navigation"
				})
			});

		},

		createFilters: function (oState) {
			const aFilter = [];
			Object.keys(oState.Filter).forEach((sFilterKey) => {
				const filterPath = this.oMetadataHelper.getProperty(sFilterKey).path;

				oState.Filter[sFilterKey].forEach(function (oConditon) {
					aFilter.push(new Filter(filterPath, oConditon.operator, oConditon.values[0]));
				});
			});

			this.byId("filterInfo").setVisible(aFilter.length > 0);

			return aFilter;
		},

		createSorters: function (oState, aExistingSorter) {
			const aSorter = aExistingSorter || [];
			oState.Sorter.forEach(function (oSorter) {
				const oExistingSorter = aSorter.find(function (oSort) {
					return oSort.sPath === this.oMetadataHelper.getProperty(oSorter.key).path;
				}.bind(this));

				if (oExistingSorter) {
					oExistingSorter.bDescending = !!oSorter.descending;
				} else {
					aSorter.push(new Sorter(this.oMetadataHelper.getProperty(oSorter.key).path, oSorter.descending));
				}
			}.bind(this));

			oState.Sorter.forEach((oSorter) => {
				const oCol = this.byId("persoTable").getColumns().find((oColumn) => oColumn.data("p13nKey") === oSorter.key);
				if (oSorter.sorted !== false) {
					oCol.setSortIndicator(oSorter.descending ? coreLibrary.SortOrder.Descending : coreLibrary.SortOrder.Ascending);
				}
			});

			return aSorter;
		},

		createGroups: function (oState) {
			const aGroupings = [];
			oState.Groups.forEach(function (oGroup) {
				aGroupings.push(new Sorter(this.oMetadataHelper.getProperty(oGroup.key).path, false, true));
			}.bind(this));

			oState.Groups.forEach((oSorter) => {
				const oCol = this.byId("persoTable").getColumns().find((oColumn) => oColumn.data("p13nKey") === oSorter.key);
				oCol.data("grouped", true);
			});

			return aGroupings;
		},

		updateColumns: function (oState) {
			const oTable = this.byId("persoTable");

			oTable.getColumns().forEach((oColumn, iIndex) => {
				oColumn.setVisible(false);
				oColumn.setWidth(oState.ColumnWidth[this._getKey(oColumn)]);
				oColumn.setSortIndicator(coreLibrary.SortOrder.None);
				oColumn.data("grouped", false);
			});

			oState.Columns.forEach((oProp, iIndex) => {
				const oCol = oTable.getColumns().find((oColumn) => oColumn.data("p13nKey") === oProp.key);
				oCol.setVisible(true);

				oTable.removeColumn(oCol);
				oTable.insertColumn(oCol, iIndex);
			});
		},

		beforeOpenColumnMenu: function (oEvt) {
			const oMenu = this.byId("menu");
			const oColumn = oEvt.getParameter("openBy");
			const oSortItem = oMenu.getQuickActions()[0].getItems()[0];
			const oGroupItem = oMenu.getQuickActions()[1].getItems()[0];

			oSortItem.setKey(this._getKey(oColumn));
			oSortItem.setLabel(oColumn.getHeader().getText());
			oSortItem.setSortOrder(oColumn.getSortIndicator());

			oGroupItem.setKey(this._getKey(oColumn));
			oGroupItem.setLabel(oColumn.getHeader().getText());
			oGroupItem.setGrouped(oColumn.data("grouped"));
		},

		onFilterInfoPress: function (oEvt) {
			this._openPersoDialog(["Filter"], oEvt.getSource());
		},

		onSort: function (oEvt) {
			const oSortItem = oEvt.getParameter("item");
			const oTable = this.byId("persoTable");
			const sAffectedProperty = oSortItem.getKey();
			const sSortOrder = oSortItem.getSortOrder();

			//Apply the state programatically on sorting through the column menu
			//1) Retrieve the current personalization state
			Engine.getInstance().retrieveState(oTable).then(function (oState) {

				//2) Modify the existing personalization state --> clear all sorters before
				oState.Sorter.forEach(function (oSorter) {
					oSorter.sorted = false;
				});

				if (sSortOrder !== coreLibrary.SortOrder.None) {
					oState.Sorter.push({
						key: sAffectedProperty,
						descending: sSortOrder === coreLibrary.SortOrder.Descending
					});
				}

				//3) Apply the modified personalization state to persist it in the VariantManagement
				Engine.getInstance().applyState(oTable, oState);
			});
		},

		onGroup: function (oEvt) {
			const oGroupItem = oEvt.getParameter("item");
			const oTable = this.byId("persoTable");
			const sAffectedProperty = oGroupItem.getKey();

			//1) Retrieve the current personalization state
			Engine.getInstance().retrieveState(oTable).then(function (oState) {

				//2) Modify the existing personalization state --> clear all groupings before
				oState.Groups.forEach(function (oSorter) {
					oSorter.grouped = false;
				});

				if (oGroupItem.getGrouped()) {
					oState.Groups.push({
						key: sAffectedProperty
					});
				}

				//3) Apply the modified personalization state to persist it in the VariantManagement
				Engine.getInstance().applyState(oTable, oState);
			});
		},

		onColumnMove: function (oEvt) {
			const oDraggedColumn = oEvt.getParameter("draggedControl");
			const oDroppedColumn = oEvt.getParameter("droppedControl");

			if (oDraggedColumn === oDroppedColumn) {
				return;
			}

			const oTable = this.byId("persoTable");
			const sDropPosition = oEvt.getParameter("dropPosition");
			const iDraggedIndex = oTable.indexOfColumn(oDraggedColumn);
			const iDroppedIndex = oTable.indexOfColumn(oDroppedColumn);
			const iNewPos = iDroppedIndex + (sDropPosition == "Before" ? 0 : 1) + (iDraggedIndex < iDroppedIndex ? -1 : 0);
			const sKey = this._getKey(oDraggedColumn);

			Engine.getInstance().retrieveState(oTable).then(function (oState) {

				const oCol = oState.Columns.find(function (oColumn) {
					return oColumn.key === sKey;
				}) || {
					key: sKey
				};
				oCol.position = iNewPos;

				Engine.getInstance().applyState(oTable, {
					Columns: [oCol]
				});
			});
		},

		onColumnResize: function (oEvt) {
			const oColumn = oEvt.getParameter("column");
			const sWidth = oEvt.getParameter("width");
			const oTable = this.byId("persoTable");

			const oColumnState = {};
			oColumnState[this._getKey(oColumn)] = sWidth;

			Engine.getInstance().applyState(oTable, {
				ColumnWidth: oColumnState
			});
		},

		onClearFilterPress: function (oEvt) {
			const oTable = this.byId("persoTable");
			Engine.getInstance().retrieveState(oTable).then(function (oState) {
				for (var sKey in oState.Filter) {
					oState.Filter[sKey].map((condition) => {
						condition.filtered = false;
					});
				}
				Engine.getInstance().applyState(oTable, oState);
			});
		},
		onInvoiceValueHelp: function () {
			var that = this;

			// ===================================================
			// 1. Define columns for Value Help
			// ===================================================
			var aCols = [
				{ label: "Invoice No", path: "invoice_no", width: "12rem" },
				// { label: "Customer Name", path: "CustomerName", width: "12rem" }
			];

			// ===================================================
			// 2. Create the ValueHelpDialog
			// ===================================================
			var oVHD = new ValueHelpDialog({
				title: "Select Invoice no",
				supportMultiselect: true,
				key: "invoice_no",            // key field
				descriptionKey: "invoice_no", // field shown in description
				ok: function (e) {
					var aTokens = e.getParameter("tokens"); // all selected tokens
					var oMultiInput = that.byId("idAccountingDocument");

					// Remove existing tokens
					oMultiInput.removeAllTokens();

					// Add all selected tokens
					aTokens.forEach(function (oToken) {
						oMultiInput.addToken(new sap.m.Token({
							key: oToken.getKey(),
							text: oToken.getText()
						}));
					});

					// Fire change event with combined keys (optional)
					var sCombined = aTokens.map(t => t.getKey()).join(", ");
					oMultiInput.fireChange({
						value: sCombined,
						newValue: sCombined,
						valid: true
					});

					oVHD.close();
				},
				cancel: function () { oVHD.close(); },
				afterClose: function () { oVHD.destroy(); }
			});

			// ===================================================
			// 3. Configure Table inside ValueHelpDialog
			// ===================================================
			var oTable = oVHD.getTable();
			// Build mandatory filter for DocumentType
			// var oDocTypeFilter = new sap.ui.model.Filter("BillingDocumentType", sap.ui.model.FilterOperator.EQ, sDocType);
			// Add columns and row/item binding depending on table type
			if (oTable.bindRows) {
				// Grid Table (sap.ui.table.Table)
				aCols.forEach(c => oTable.addColumn(new sap.ui.table.Column({
					label: c.label,
					template: new sap.m.Text({ text: "{" + c.path + "}" }),
					width: c.width
				})));
				oTable.bindRows({ path: "/Header" });
			} else {
				// Responsive Table (sap.m.Table)
				aCols.forEach(c => oTable.addColumn(new sap.m.Column({
					header: new sap.m.Label({ text: c.label })
				})));
				oTable.bindItems({
					path: "/Header",
					template: new sap.m.ColumnListItem({
						cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
					})
				});
			}

			// ===================================================
			// 4. Central Search Function
			// ===================================================
			var fnDoSearch = function (sQuery) {
				sQuery = (sQuery || "").trim();

				var sAgg = oTable.bindRows ? "rows" : "items";
				var oBinding = oTable.getBinding(sAgg);

				if (!sQuery) {
					// Clear filters if query empty
					oBinding.filter([]);
					return;
				}

				// --- Step A: Try client-side filtering ---
				var aFilters = aCols.map(c =>
					new sap.ui.model.Filter(c.path, sap.ui.model.FilterOperator.Contains, sQuery)
				);

				// combine them with OR
				var oOrFilter = new sap.ui.model.Filter({
					filters: aFilters,
					and: false
				});

				oBinding.filter([oOrFilter], "Application");

				// --- Step B: If no results, fallback to server-side search ---
				if (oBinding.getLength() === 0) {
					var oModel = that.getView().getModel();
					// Server-side (ODataModel)
					oModel.read("/Header", {
						filters: [oOrFilter],        // <-- use Filter object, not string
						urlParameters: { "$top": 200 },
						success: function (oData) {
							var oJson = new sap.ui.model.json.JSONModel({
								Header: oData.results
							});
							oTable.setModel(oJson);
							// rebind to make sure busy state clears
							if (oTable.bindRows) {
								oTable.bindRows({ path: "/Header" });
							} else {
								oTable.bindItems({
									path: "/Header",
									template: new sap.m.ColumnListItem({
										cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
									})
								});
							}
							oTable.setBusy(false);
							oVHD.setBusy(false);
						},
						error: function () {
							sap.m.MessageToast.show("Server search failed");
						}
					});
				}
			};

			// ===================================================
			// 5. SearchField + FilterBar Setup
			// ===================================================
			var oBasicSearch = new sap.m.SearchField({
				width: "100%",
				search: function (oEvt) {   // triggers on Enter or search icon
					fnDoSearch(oEvt.getSource().getValue());
				}
				// Optional: add liveChange if you want instant typing search
				// liveChange: function (oEvt) {
				//     fnDoSearch(oEvt.getSource().getValue());
				// }
			});

			var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
				advancedMode: true,
				search: function () {
					fnDoSearch(oBasicSearch.getValue());
				}
			});
			oFilterBar.setBasicSearch(oBasicSearch);
			oVHD.setFilterBar(oFilterBar);

			// ===================================================
			// 6. Prefill Search with existing value (if any)
			// ===================================================
			var sPrefill = this.byId("idAccountingDocument").getValue();
			oBasicSearch.setValue(sPrefill);
			oVHD.setBasicSearchText(sPrefill);

			// ===================================================
			// 7. Attach model and open dialog
			// ===================================================
			oTable.setModel(this.getView().getModel());
			oVHD.open();
		},
		onAsnValueHelp: function () {
			var that = this;

			// ===================================================
			// 1. Define columns for Value Help
			// ===================================================
			var aCols = [
				{ label: "ASN No", path: "AsnNo", width: "12rem" },
				// { label: "Customer Name", path: "CustomerName", width: "12rem" }
			];

			// ===================================================
			// 2. Create the ValueHelpDialog
			// ===================================================
			var oVHCustomer = new ValueHelpDialog({
				title: "Select ASN",
				supportMultiselect: true,
				key: "AsnNo",            // key field
				descriptionKey: "AsnNo", // field shown in description
				ok: function (e) {
					var aTokens = e.getParameter("tokens"); // all selected tokens
					var oMultiInput = that.byId("idCustomer");

					// Remove existing tokens before adding new ones
					oMultiInput.removeAllTokens();

					// Add all selected tokens
					aTokens.forEach(function (oToken) {
						oMultiInput.addToken(new sap.m.Token({
							key: oToken.getKey(),
							text: oToken.getText()
						}));
					});

					// Fire change event with combined values (optional)
					var sCombined = aTokens.map(t => t.getKey()).join(", ");
					oMultiInput.fireChange({
						value: sCombined,
						newValue: sCombined,
						valid: true
					});

					oVHCustomer.close();
				},
				cancel: function () { oVHCustomer.close(); },
				afterClose: function () { oVHCustomer.destroy(); }
			});

			// ===================================================
			// 3. Configure Table inside ValueHelpDialog
			// ===================================================
			var oTable = oVHCustomer.getTable();
			// Build mandatory filter for DocumentType
			// var oDocTypeFilter = new sap.ui.model.Filter("BillingDocumentType", sap.ui.model.FilterOperator.EQ, sDocType);
			// Add columns and row/item binding depending on table type
			if (oTable.bindRows) {
				// Grid Table (sap.ui.table.Table)
				aCols.forEach(c => oTable.addColumn(new sap.ui.table.Column({
					label: c.label,
					template: new sap.m.Text({ text: "{" + c.path + "}" }),
					width: c.width
				})));
				oTable.bindRows({
					path: "/Header",
					//  filters: [oDocTypeFilter] 
				});
			} else {
				// Responsive Table (sap.m.Table)
				aCols.forEach(c => oTable.addColumn(new sap.m.Column({
					header: new sap.m.Label({ text: c.label })
				})));
				oTable.bindItems({
					path: "/Header",
					template: new sap.m.ColumnListItem({
						cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
					})
				});
			}

			// ===================================================
			// 4. Central Search Function
			// ===================================================
			var fnDoSearch = function (sQuery) {
				sQuery = (sQuery || "").trim();

				var sAgg = oTable.bindRows ? "rows" : "items";
				var oBinding = oTable.getBinding(sAgg);

				if (!sQuery) {
					// Clear filters if query empty
					oBinding.filter([]);
					return;
				}

				// --- Step A: Try client-side filtering ---
				var aFilters = aCols.map(c =>
					new sap.ui.model.Filter(c.path, sap.ui.model.FilterOperator.Contains, sQuery)
				);

				// combine them with OR
				var oOrFilter = new sap.ui.model.Filter({
					filters: aFilters,
					and: false
				});

				oBinding.filter([oOrFilter], "Application");

				// --- Step B: If no results, fallback to server-side search ---
				if (oBinding.getLength() === 0) {
					var oModel = that.getView().getModel();
					// Server-side (ODataModel)
					oModel.read("/Header", {
						filters: [oOrFilter],        // <-- use Filter object, not string
						urlParameters: { "$top": 200 },
						success: function (oData) {
							var oJson = new sap.ui.model.json.JSONModel({
								Header: oData.results
							});
							oTable.setModel(oJson);
							// rebind to make sure busy state clears
							if (oTable.bindRows) {
								oTable.bindRows({ path: "/Header" });
							} else {
								oTable.bindItems({
									path: "/Header",
									template: new sap.m.ColumnListItem({
										cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
									})
								});
							}
							oTable.setBusy(false);
							oVHCustomer.setBusy(false);
						},
						error: function () {
							sap.m.MessageToast.show("Server search failed");
						}
					});
				}
			};

			// ===================================================
			// 5. SearchField + FilterBar Setup
			// ===================================================
			var oBasicSearch = new sap.m.SearchField({
				width: "100%",
				search: function (oEvt) {   // triggers on Enter or search icon
					fnDoSearch(oEvt.getSource().getValue());
				}
				// Optional: add liveChange if you want instant typing search
				// liveChange: function (oEvt) {
				//     fnDoSearch(oEvt.getSource().getValue());
				// }
			});

			var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
				advancedMode: true,
				search: function () {
					fnDoSearch(oBasicSearch.getValue());
				}
			});
			oFilterBar.setBasicSearch(oBasicSearch);
			oVHCustomer.setFilterBar(oFilterBar);

			// ===================================================
			// 6. Prefill Search with existing value (if any)
			// ===================================================
			var sPrefill = this.byId("idCustomer").getValue();
			oBasicSearch.setValue(sPrefill);
			oVHCustomer.setBasicSearchText(sPrefill);

			// ===================================================
			// 7. Attach model and open dialog
			// ===================================================
			oTable.setModel(this.getView().getModel());
			oVHCustomer.open();
		},
		onStatusChange: function (oEvent) {
			var oMCB = oEvent.getSource();
			var aSelectedKeys = oMCB.getSelectedKeys(); // array of keys
			console.log("Selected Status:", aSelectedKeys);

			// Example: join into comma string
			// var sJoined = aSelectedKeys.join(", ");
		},

		_loadBillingDocumentData: function (aFilters, bReset) {
			var that = this;

			if (bReset) {
				this._iPage = 0;
				this._bAllDataLoaded = false;
			}

			if (this._bAllDataLoaded) return;

			if (!this._bSkipFirstUpdate) {
				this.getView().setBusy(true);
			}

			var oModel = this.getOwnerComponent().getModel();
			var iSkip = this._iPage * this._iPageSize;

			oModel.read("/Header", {
				urlParameters: {
					"$top": this._iPageSize,
					"$skip": iSkip,
					"$orderby": "invoice_date desc"
				},
				filters: aFilters || that._aCurrentFilters || [],
				success: function (oData) {
					var oListModel = that.getOwnerComponent().getModel("getListReport");

					if (bReset || !that._iPage) {
						// First page (or filter applied): reset data
						oListModel.setData(oData.results);
					} else {
						// Append data for paging
						var aExisting = oListModel.getData();
						oListModel.setData(aExisting.concat(oData.results));
					}

					// If fewer than page size → no more data
					if (oData.results.length < that._iPageSize) {
						that._bAllDataLoaded = true;
					}

					that._iPage++;
					that.getView().setBusy(false);
				},
				error: function (oError) {
					that.getView().setBusy(false);
					MessageBox.error("Failed to load Billing Document data");
					console.error("OData Error: ", oError);
				}
			});
		},

		onUpdateStartPoHeaderTable: function (oEvent) {
			if (!this._bSkipFirstUpdate) {
				// First binding, skip loading
				this._bSkipFirstUpdate = true;  // skip the first updateStarted
				return;
			}
			// Check if it's really a scroll (reason = Growing)
			if (oEvent.getParameter("reason") === "Growing" && !this._bAllDataLoaded) {
				this._loadBillingDocumentData(null, false);
			}
		},

		// onFilterGo: function (oEvent) {
		// 	var oFilterBar = this.byId("idFilterBar"); // your filterbar id
		// 	var oModel = this.getOwnerComponent().getModel(); // OData Model
		// 	var aFilters = [];
		// 	let oDateFormat = DateFormat.getInstance({
		// 		pattern: "yyyy-MM-dd"
		// 	});
		// 	var oMultiInput = this.byId("idCustomer"); // get control by id

		// 	// 1. Get raw text (current input value, not yet a token)
		// 	var sValue = oMultiInput.getValue();
		// 	// ====== Billing Document ======
		// 	var aBillingDocs = this.byId("idAccountingDocument").getTokens();
		// 	if (aBillingDocs.length > 0 || sValue) {
		// 		aBillingDocs.forEach(function (oToken) {
		// 			aFilters.push(new sap.ui.model.Filter("invoice_no", sap.ui.model.FilterOperator.EQ, oToken.getKey() || oToken.getText()||sValue));
		// 		});
		// 	}

		// 	// ====== Document Date (DateRangeSelection) ======
		// 	var oDateRange = this.byId("idPostingDate");
		// 	if (oDateRange.getDateValue() && oDateRange.getSecondDateValue()) {
		// 		aFilters.push(new sap.ui.model.Filter("invoice_date", sap.ui.model.FilterOperator.BT,
		// 			oDateFormat.format(new Date(oDateRange.getDateValue())), oDateFormat.format(new Date(oDateRange.getSecondDateValue()))));
		// 	}

		// 	// ====== Customer ======
		// 	var aCustomers = this.byId("idCustomer").getTokens();
		// 	if (aCustomers.length > 0) {
		// 		aCustomers.forEach(function (oToken) {
		// 			aFilters.push(new sap.ui.model.Filter("AsnNo", sap.ui.model.FilterOperator.EQ, oToken.getKey() || oToken.getText()));
		// 		});
		// 	}

		// 	// ====== Status ======
		// 	var aStatusKeys = this.byId("idStatus").getSelectedKeys();
		// 	if (aStatusKeys.length > 0) {
		// 		var aStatusFilters = aStatusKeys.map(function (sKey) {
		// 			return new sap.ui.model.Filter("Status_Desc", sap.ui.model.FilterOperator.EQ, sKey);
		// 		});
		// 		aFilters.push(new sap.ui.model.Filter({ filters: aStatusFilters, and: false })); // OR logic
		// 	}
		// 	this._aCurrentFilters = aFilters;
		// 	// ====== Call OData Service ======
		// 	this._loadBillingDocumentData(aFilters, true);
		// },

		onFilterGo: function (oEvent) {
			this.getView().setBusy(true);
			var oFilterBar = this.byId("idFilterBar"); // your filterbar id
			var oModel = this.getOwnerComponent().getModel(); // OData Model
			var aFilters = [];
			let oDateFormat = DateFormat.getInstance({
				pattern: "yyyy-MM-dd"
			});

			// ====== Invoice Number (MultiInput) ======
			var oBillingInput = this.byId("idAccountingDocument");
			var aBillingDocs = oBillingInput.getTokens();
			var sBillingRaw = oBillingInput.getValue(); // NEW: catch raw typed value

			if (aBillingDocs.length > 0) {
				aBillingDocs.forEach(function (oToken) {
					aFilters.push(new sap.ui.model.Filter(
						"invoice_no",
						sap.ui.model.FilterOperator.EQ,
						oToken.getKey() || oToken.getText()
					));
				});
			}
			// if user typed directly without pressing enter
			if (sBillingRaw) { // NEW
				aFilters.push(new sap.ui.model.Filter(
					"invoice_no",
					sap.ui.model.FilterOperator.Contains,
					sBillingRaw
				));
			}

			// ====== Document Date (DateRangeSelection) ======
			var oDateRange = this.byId("idPostingDate");
			if (oDateRange.getDateValue() && oDateRange.getSecondDateValue()) {
				aFilters.push(new sap.ui.model.Filter(
					"invoice_date",
					sap.ui.model.FilterOperator.BT,
					oDateFormat.format(new Date(oDateRange.getDateValue())),
					oDateFormat.format(new Date(oDateRange.getSecondDateValue()))
				));
			}

			// ====== Customer / ASN (MultiInput) ======
			var oAsnInput = this.byId("idCustomer");
			var aCustomers = oAsnInput.getTokens();
			var sAsnRaw = oAsnInput.getValue(); // NEW: catch raw typed ASN

			if (aCustomers.length > 0) {
				aCustomers.forEach(function (oToken) {
					aFilters.push(new sap.ui.model.Filter(
						"AsnNo",
						sap.ui.model.FilterOperator.EQ,
						oToken.getKey() || oToken.getText()
					));
				});
			}
			// if user typed directly without pressing enter
			if (sAsnRaw) { // NEW
				aFilters.push(new sap.ui.model.Filter(
					"AsnNo",
					sap.ui.model.FilterOperator.Contains,
					sAsnRaw
				));
			}

			// ====== Status (MultiComboBox or MultiSelect) ======
			var aStatusKeys = this.byId("idStatus").getSelectedKeys();
			if (aStatusKeys.length > 0) {
				var aStatusFilters = aStatusKeys.map(function (sKey) {
					return new sap.ui.model.Filter("Status_Desc", sap.ui.model.FilterOperator.EQ, sKey);
				});
				aFilters.push(new sap.ui.model.Filter({ filters: aStatusFilters, and: false })); // OR logic
			}

			this._aCurrentFilters = aFilters;

			// ====== Call OData Service ======
			this._loadBillingDocumentData(aFilters, true);
		},

		onLineItemPress: function (oEvent) {
			this.getView().setBusy(true);
			var oPressedItem = oEvent.getParameter("listItem"); // item that was pressed
			var oContext = oPressedItem.getBindingContext("getListReport"); // use your model name
			var oRowData = oContext.getObject();

			this.getOwnerComponent().getModel("selectedModel").setData(oRowData);

			this.onClickNext(); // navigate or next step
		},
		onClickNext: function () {

			this.getOwnerComponent().getRouter().navTo("RouteObject", {
			}, true); // replace with actual route

		}

	});
});