Ext.define('Onc.tabs.VmMapTab', {
    extend: 'Onc.tabs.Tab',
    alias: 'widget.computevmmaptab',
    requires: 'Ext.util.MixedCollection',

    layout: 'fit',

    initComponent: function() {
        this.items = [{
            xtype: 'gridpanel',
            hideHeaders: true,
            columnLines: true,
            id: 'vmmap',
            store: 'PhysicalComputesStore',
            selection: Ext.create('Ext.util.MixedCollection'),

            dockedItems: !ENABLE_VMMAP_TOOLBAR ? undefined : [
                {xtype: 'toolbar',
                itemId: 'toolbar',
                items: (!ENABLE_VMMAP_REFRESH ? [] : [{
                    icon: 'img/icon/refresh.png',
                    text: 'Refresh',
                    scope: this,
                    handler: this.updateAll
                }]).concat(!ENABLE_VMMAP_RESIZE ? [] : [{
                    icon: 'img/icon/resize.png',
                    itemId: 'resize',
                    text: 'Resize',
                    scope: this,
                    handler: this.onResizeClick
                }]).concat(!ENABLE_VMMAP_TAG ? [] : [{
                    iconCls: 'icon-tag',
                    itemId: 'tag',
                    text: 'Tag',
                    disabled: true,
                    hidden: true,
                    scope: this,
                    handler: this.onTagClick
                }]).concat(!ENABLE_VMMAP_MIGRATE ? [] : [{
                    icon: 'img/icon/migrate.png',
                    itemId: 'migrate',
                    text: 'Migrate',
                    scope: this,
                    handler: this.onMigrateClick
                }])}
            ],

            columns: [
                {header: 'Name', dataIndex: 'hostname', width: 100},
                //{header: 'Disk pool size', dataIndex: 'diskspace', width: 15},
                {header: 'Map', dataIndex: 'memory', flex: 1,
                    renderer: function(totalMemory, meta, rec) {
                        // FIXME: 'memory' is 0
                        totalMemory = rec.get('memory_usage') * 2;

                        var freeMemory = totalMemory;
                        var vm_list = "";

                        rec.getChild('vms').children().each( function(vm) {
                            var memory = vm.get('memory');
                            var id = 'vmmap-' + vm.get('id');
                            var uptime = this.getUptime(vm);
                            var width = parseInt(200 * (memory / totalMemory));
                            var classNames = 'node-cell';

                            if (this.selection.contains(id)) {
                                classNames += ' selected';
                            }
                            if (uptime === 'inactive') {
                                classNames += ' inactive';
                            }

                            vm_list += ['<div class="' + classNames + '"',
                                ' id="' + id + '"',
                                ' style="min-width:' + width + 'px">',
                                '<div class="name">' + vm.get('hostname') + '</div>',
                                //'<div class="name">' + vm.get('ipv4_address') + '</div>',
                                '<div class="mem">' + parseInt(memory) + '</div>',
                                '<span class="uptime">' + uptime + '</span>',
                                '<span class="cores">' + vm.get('num_cores') + '</span>',
                                '</div>'].join('\n');

                            freeMemory -= memory;
                        }, this);

                        if (freeMemory) {
                            var width = parseInt(200 * (freeMemory / totalMemory));
                            vm_list += ['<div class="node-cell-free" style="min-width:"' + width + 'px">',
                                '<div class="name">free</div>',
                                '<div class="mem">' + parseInt(freeMemory) + '</div>',
                                '</div>'].join('\n');
                        }

                        return vm_list;
                    }
                }
            ],

            afterRender: function() {
                this.mon(this.el, 'click', this.onMouseClick, this);
                this.mon(this.el, 'dblclick', this.onMouseDoubleClick, this);
                this.mon(this.store, {scope: this, update: this.updateCellEvent});

                this.addEvents('showvmdetails');//, 'startvms', 'stopvms');
            },

            getUptime: function(rec) {
                if (rec.get('state') === 'inactive')
                    return 'inactive';
                var timestamp = new Date(Date.parse(rec.get('startup_timestamp')));

                var s = Math.round((+(new Date()) - +timestamp) / 1000);

                var days = Math.floor(s / 86400);
                s -= days * 86400;

                var hours = Math.floor(s / 3600);

                return '' + days + 'd ' + (hours ? (hours + 'h ') : '');
            },

            updateCell: function(store, rec) {
                var el = Ext.get('vmmap-' + rec.get('id'));
                if (el) {
                    el.child('div.name', true).innerHTML = rec.get('hostname');
                    el.child('div.mem', true).innerHTML = rec.get('memory');
                    el.child('span.uptime', true).innerHTML = this.getUptime(rec);
                    el.child('span.cores', true).innerHTML = rec.get('num_cores');
                    if (rec.get('state') === 'inactive') {
                        el.addCls('inactive');
                    } else {
                        el.removeCls('inactive');
                    }
                }
            },

            updateCellEvent: function(store, rec, action) {
                if (action === 'edit') {
                    this.updateCell(store, rec);
                }
            },

            onResizeStart: function(e, el) {
                if (e.button != 0) {
                    return;
                }

                el = e.getTarget('div.resizer');
                if (!el) {
                    return;
                }

                this.resizingCell = el.parentNode.firstChild;
                this.originalWidth = parseInt(this.resizingCell.style.getPropertyValue('width'));
                this.resizeAnchor = [e.getX(), e.getY()];
                this.originalSize = parseInt(Ext.get(this.resizingCell).child('div.mem', true).innerHTML);
            },

            onResize: function(e, el) {
                if (!this.resizingCell) {
                    return;
                }
                var pos = e.getXY();
                var delta = [pos[0] - this.resizeAnchor[0], pos[1] - this.resizeAnchor[1]];
                this.resizingCell.style.setProperty('width', (Math.max(this.originalWidth + delta[0], 1)) + 'px');
                this.newSize = this.originalSize + delta[0];
                Ext.get(this.resizingCell).child('div.mem', true).innerHTML = this.newSize;
                e.stopEvent();
            },

            onResizeEnd: function(e, el) {
                var me = this;
                if (!this.resizingCell) {
                    return;
                }
                Ext.Msg.show({
                    title:'Resize',
                    msg: 'Resize VM from ' + this.originalSize +
                       ' MB to ' + this.newSize + 'MB?',
                    buttons: Ext.Msg.YESNO,
                    icon: Ext.Msg.QUESTION,
                    scope: me,
                    fn: function(buttonId) {
                        if (buttonId === 'no') {
                            Ext.get(this.resizingCell).child('div.mem', true).innerHTML = this.originalSize;
                            this.resizingCell.style.setProperty('width', (Math.max(this.originalWidth, 1)) + 'px');
                        } else {
                            rec = this.getRecordFromId(this.getIdFromEl(this.resizingCell));
                            rec.set('memory', this.newSize);
                            rec.save();
                        }

                        this.vmmapTab.disableResizing();
                        delete this.resizingCell;
                        delete this.originalWidth;
                        delete this.resizeAnchor;
                        delete this.originalSize;
                        delete this.newSize;
                    }
                });
            },

            onMouseClick: function(e, el) {
                if (this.resizeMode) {
                    return;
                }

                el = e.getTarget('div.node-cell');
                el = Ext.get(el);
                if (!el) {
                    return;
                }

                if (e.shiftKey) {
                    var from = this.lastSelectedCell || this.el.down('div.node-cell');
                    var allCells = Ext.select('div.node-cell', true, this.el.dom);
                    var to = allCells.indexOf(el);

                    from = allCells.indexOf(from);
                    if (from > to) {
                        var temp = from;
                        from = to;
                        to = temp;
                    }

                    var i, item;
                    if (!e.ctrlKey) {
                        for (i = 0; i < allCells.getCount(); i++) {
                            if (i < from || i > to) {
                                cell = allCells.item(i);
                                if (this.selection.contains(cell.id)) {
                                    cell.removeCls('selected');
                                }
                            }
                        }
                        this.selection.clear();
                    }

                    for (i = from; i <= to; i++) {
                        cell = allCells.item(i);
                        this.selection.add(cell.id);
                        cell.addCls('selected');
                    }

                } else if (e.ctrlKey) {
                    if (el.hasCls('selected')) {
                        el.removeCls('selected');
                        this.selection.remove(el.id);
                    } else {
                        el.addCls('selected');
                        this.selection.add(el.id);
                    }

                    this.lastSelectedCell = el;

                } else {
                    this.selection.each(function(id) {
                        if (id !== el.id) {
                            Ext.get(id).removeCls('selected');
                        }
                    });
                    this.selection.clear();
                    this.selection.add(el.id);
                    el.addCls('selected');

                    this.lastSelectedCell = el;
                }

                if (ENABLE_VMMAP_TAG) {
                    var toolbar = this.getDockedComponent('toolbar');
                    var tagbtn = toolbar.getComponent('tag');
                    if (this.selection.getCount() > 0) {
                        tagbtn.enable();
                    } else {
                        tagbtn.disable();
                    }
                }
            },

            onMouseDoubleClick: function(e, el) {
                if (this.resizeMode || this.migrateMode) {
                    return;
                }

                el = e.getTarget('div.node-cell');
                el = Ext.get(el);
                if (el) {
                    this.fireEvent('showvmdetails', this.getIdFromEl(el));
                    return;
                }

                el = e.getTarget('tr.x-grid-row');
                if (el) {
                    if (e.getTarget('div.node-cell-free')) {
                        this.fireEvent('newvm', this.getView().getRecord(el));
                    } else {
                        this.fireEvent('showvmdetails', this.getView().getRecord(el).get('id'));
                    }
                }
            },

            getIdFromEl: function(el) {
                return el.id.substring(6); // remove 'vmmap-' from the beginning
            },

            getRecordFromId: function(id) {
                return Ext.getStore('ComputesStore').findRecord('id', id);
            }
        }];

        this.callParent(arguments);
    },

    afterRender: function() {
        this.vmmap = Ext.getCmp('vmmap');
        this.vmmap.vmmapTab = this;

        this.callParent(arguments);
    },

    updateAll: function() {
        var vmmap = this.vmmap;
        var store = vmmap.store;
        store.each(function(record) {
            vmmap.updateCell(store, record);
        });
        vmmap.getView().refresh();
    },

    onTagClick: function() {
        var cellList = "";
        this.vmmap.selection.each(function(id) {
            cellList += id + '<br>';
        });
        Ext.Msg.alert('Tag', cellList);
    },

    enableResizing: function() {
        var vmmap = this.vmmap;
        var vmmapEl = vmmap.getEl();

        vmmap.resizeMode = true;
        vmmap.getDockedComponent('toolbar').getComponent('resize').setText('Cancel Resize');

        var allCells = Ext.select('div.node-cell', true, this.el.dom);
        for (i = 0; i < allCells.getCount(); i++) {
            var cellEl = allCells.item(i);
            var cell = cellEl.dom;
            var cellStyle = cell.style;

            var width = Math.max(parseInt(cellStyle.getPropertyValue('min-width')), 1);
            cellStyle.removeProperty('min-width');
            cellStyle.setProperty('width', width + 'px');
            cellStyle.setProperty('overflow-x', 'hidden');

            var resizeContainer = document.createElement("div");
            var resizer = document.createElement("div");
            resizeContainer.className = 'resize-container';
            resizer.className = 'resizer';
            Ext.fly(resizer).setHeight(cellEl.getHeight());
            cell.parentNode.insertBefore(resizeContainer, cell.nextSibling);
            cell.parentNode.removeChild(cell);
            resizeContainer.appendChild(cell);
            resizeContainer.appendChild(resizer);
        }

        this.mon(vmmapEl, 'mousedown', vmmap.onResizeStart, vmmap);
        this.mon(vmmapEl, 'mousemove', vmmap.onResize, vmmap);
        Ext.EventManager.on(document, 'mouseup', vmmap.onResizeEnd, vmmap);
    },

    disableResizing: function() {
        var vmmap = this.vmmap;
        var vmmapEl = vmmap.getEl();

        vmmap.resizeMode = false;
        vmmap.getDockedComponent('toolbar').getComponent('resize').setText('Resize');

        var resizers = Ext.select('div.resizer', true, vmmap.el.dom);
        for (i = 0; i < resizers.getCount(); i++) {
            var resizer = resizers.item(i);
            var resizeContainer = resizer.dom.parentNode;
            var cell = resizeContainer.firstChild;
            var cellStyle = cell.style;

            cellStyle.setProperty('min-width', cellStyle.getPropertyValue('width'));
            cellStyle.removeProperty('overflow-x');
            cellStyle.removeProperty('width');

            resizeContainer.removeChild(cell);
            resizeContainer.parentNode.insertBefore(cell, resizeContainer.nextSibling);
            resizeContainer.parentNode.removeChild(resizeContainer);
            resizer.remove();
        }

        this.mun(vmmapEl, 'mousedown', vmmap.onResizeStart, vmmap);
        this.mun(vmmapEl, 'mousemove', vmmap.onResize, vmmap);
        Ext.EventManager.un(document, 'mouseup', vmmap.onResizeEnd, vmmap);
    },

    onResizeClick: function(button) {
        if (this.vmmap.resizeMode) {
            this.disableResizing();
        } else {
            this.enableResizing();
        }
    },

    onMigrateClick: function(button) {
        this.migrateMode = !this.migrateMode;
        button.setText(this.migrateMode ? 'Cancel Migration' : 'Migrate');

        if (this.migrateMode) {
            this.dragZone = new Ext.dd.DragZone(this.getEl(), {
                getDragData: function(e) {
                    var nodeEl = e.getTarget('div.node-cell');
                    if (nodeEl) {
                        var vmmap = Ext.getCmp('vmmap');
                        var clone = nodeEl.cloneNode(true);
                        clone.id = Ext.id();
                        var sourceEl = Ext.fly(nodeEl).up('tr.x-grid-row');
                        var sourceRec = vmmap.getView().getRecord(sourceEl);
                        return {
                            ddel: clone,
                            nodeEl: nodeEl,
                            sourceRec: sourceRec,
                            repairXY: Ext.fly(nodeEl).getXY(),
                            dragSource: this,
                            vmmap: vmmap
                        }
                    }
                },

                getRepairXY: function() {
                    return this.dragData.repairXY;
                }
            });

            this.dropZone = new Ext.dd.DropZone(this.getEl(), {
                getTargetFromEvent: function(e) {
                    //return e.getTarget(Ext.getCmp('vmmap').getView().rowSelector);
                    //return e.getTarget('#vmmap tr.x-grid-row');
                    return e.getTarget('tr.x-grid-row');
                },

                onNodeOver: function(target, dd, e, data) {
                    var targetRec = data.vmmap.getView().getRecord(e.getTarget('tr.x-grid-row'));
                    if (targetRec) {
                        if (targetRec.get('id') !== data.sourceRec.get('id')) {
                            return Ext.dd.DropZone.prototype.dropAllowed;
                        }
                    }
                    return Ext.dd.DropZone.prototype.dropNotAllowed;
                },

                onNodeDrop: function(target, dd, e, data) {
                    var vmmap = data.vmmap;
                    var nodeId = vmmap.getIdFromEl(data.nodeEl);
                    var nodeRec = vmmap.getRecordFromId(nodeId);
                    var targetRec = vmmap.getView().getRecord(target);
                    Ext.Msg.show({
                        msg: "Migrate " + nodeRec.get('hostname') +
                            " from " + data.sourceRec.get('hostname') +
                            " to " + targetRec.get('hostname') + "?",
                        buttons: Ext.Msg.OKCANCEL,
                        icon: Ext.Msg.QUESTION
                    });
                    return true;
                }
            });

        } else {
            this.dragZone.unreg();
            delete this.dragZone;
            this.dropZone.unreg();
            delete this.dropZone;
        }
    }
});
