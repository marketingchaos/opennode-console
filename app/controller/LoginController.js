Ext.define('Onc.controller.LoginController', {
    extend: 'Ext.app.Controller',

    views: ['LoginWindow', 'Viewport'],

    refs: [{ref: 'searchResults', selector: '#search-results'},
           {ref: 'tabs', selector: '#mainTabs'}],

    init: function() {
        var me = this;

        Ext.Ajax.withCredentials = true;

        Ext.Ajax.request({
            url: BACKEND_PREFIX + 'auth',
            method: 'POST',
            withCredentials: true,
            success: function(response) {
                me.onAuth();
            },
            failure: function(response) {
                console.assert(response.status === 403);
                me.getView('LoginWindow').create();
            }
        });

        this.control({
            'loginwindow': {
                login: function(token) {
                    me.onAuth();
                }
            }
        });
    },

    onAuth: function() {
        Onc.hub.Hub.run();
        Ext.getStore('ComputesStore').load();
        this.getView('Viewport').create();
    }
});