(function() {
  window.LIMITE_MINIMO = 1024 * 1024 * 4.5;

  (function(global, _, Backbone) {
    global.IndexedDB = new ydn.db.Storage('Radiocentro');
    global.Offline = {
      VERSION: '0.4.3',
      localSync: function(method, model, options, store) {
        var resp, _ref;
        if (method === 'read') {
          if (_.isUndefined(model.id)) {
            return store.findAll(options);
          } else {
            return store.find(model, options);
          }
        } else {
          resp = (function() {
            switch (method) {
              case 'read':
                if (_.isUndefined(model.id)) {
                  return store.findAll(options);
                } else {
                  return store.find(model, options);
                }
                break;
              case 'create':
                return store.create(model, options);
              case 'update':
                return store.update(model, options);
              case 'delete':
                return store.destroy(model, options);
            }
          })();
          if (resp) {
            return options.success((_ref = resp.attributes) != null ? _ref : resp);
          } else {
            return typeof options.error === "function" ? options.error('Record not found') : void 0;
          }
        }
      },
      sync: function(method, model, options) {
        var store, _ref;
        store = model.storage || ((_ref = model.collection) != null ? _ref.storage : void 0);
        if (store && (store != null ? store.support : void 0)) {
          return Offline.localSync(method, model, options, store);
        } else {
          return Backbone.ajaxSync(method, model, options);
        }
      },
      onLine: function() {
        return navigator.onLine !== false;
      }
    };
    Backbone.ajaxSync = Backbone.sync;
    Backbone.sync = Offline.sync;
    Offline.Storage = (function() {
      function Storage(name, collection, options) {
        this.name = name;
        this.collection = collection;
        if (options == null) {
          options = {};
        }
        this.support = this.isLocalStorageSupport();
        this.allIds = new Offline.Index(this.name, this);
        this.destroyIds = new Offline.Index("" + this.name + "-destroy", this);
        this.sync = new Offline.Sync(this.collection, this);
        this.keys = options.keys || {};
        this.autoPush = options.autoPush || false;
      }

      Storage.prototype.isLocalStorageSupport = function() {
        var e;
        try {
          localStorage.setItem('isLocalStorageSupport', '1');
          localStorage.removeItem('isLocalStorageSupport');
          return true;
        } catch (_error) {
          e = _error;
          return false;
        }
      };

      Storage.prototype.checkQuota = function(fn) {
        if (window.webkitStorageInfo) {
          return window.webkitStorageInfo.queryUsageAndQuota(webkitStorageInfo.TEMPORARY, fn);
        } else {
          return fn(-1, -1);
        }
      };

      Storage.prototype.clearNext = function(keys_updated, fn, i, removidos) {
        var self;
        if (i == null) {
          i = 0;
        }
        if (removidos == null) {
          removidos = 0;
        }
        if (!keys_updated[i]) {
          fn(removidos);
          return false;
        }
        self = this;
        return this.checkQuota(function(used, remaining) {
          var e;
          if (remaining === -1 && removidos >= 20) {
            fn(removidos);
            return false;
          }
          if (remaining > window.LIMITE_MINIMO || removidos >= 20) {
            fn(removidos);
            return false;
          }
          try {
            localStorage.removeItem(keys_updated[i].id);
            removidos += 1;
          } catch (_error) {
            e = _error;
          }
          return self.clearNext(keys_updated, fn, i + 1, removidos);
        });
      };

      Storage.prototype.setItem = function(key, value, retry) {
        var e, id, match, self;
        if (retry == null) {
          retry = false;
        }
        self = this;
        if (match = key.match(/([^-]*)-([^\s]*)/)) {
          try {
            id = (match[2] === "new" ? match[2] : +match[2]);
            return IndexedDB.put(match[1], value, id);
          } catch (_error) {
            e = _error;
          }
        }
      };

      Storage.prototype.removeItem = function(key) {
        return localStorage.removeItem(key);
      };

      Storage.prototype.getItem = function(key, callback) {
        var e, match;
        if (match = key.match(/([^-]*)-([^\s]*)/)) {
          try {
            return IndexedDB.get(match[1], +match[2]).done(callback);
          } catch (_error) {
            e = _error;
          }
        }
      };

      Storage.prototype.create = function(model, options) {
        if (options == null) {
          options = {};
        }
        options.regenerateId = true;
        return this.save(model, options);
      };

      Storage.prototype.update = function(model, options) {
        if (options == null) {
          options = {};
        }
        return this.save(model, options);
      };

      Storage.prototype.destroy = function(model, options) {
        var sid;
        if (options == null) {
          options = {};
        }
        if (!model.get('sid')) {
          if (!(options.local || (sid = model.get('id')) === 'new')) {
            this.destroyIds.add(model.get('id'));
          }
        } else {
          if (!(options.local || (sid = model.get('sid')) === 'new')) {
            this.destroyIds.add(sid);
          }
        }
        return this.remove(model, options);
      };

      Storage.prototype.find = function(model, options) {
        if (options == null) {
          options = {};
        }
        return this.getItem("" + this.name + "-" + model.id, function(data) {
          return options.success(data);
        });
      };

      Storage.prototype.findAll = function(options) {
        var err, self;
        if (options == null) {
          options = {};
        }
        if (!Offline.onLine()) {
          options.local = true;
        }
        self = this;
        try {
          return IndexedDB.from(this.name).list().done(function(data) {
            if (options.local) {
              return options.success(data);
            } else if (data.length === 0) {
              return self.sync.full(self.name, options);
            } else {
              return self.sync.incremental(options);
            }
          });
        } catch (_error) {
          err = _error;
          return self.sync.full(self.name, options);
        }
      };

      Storage.prototype.s4 = function() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
      };

      Storage.prototype.incrementId = 0x1000000;

      Storage.prototype.localId1 = ((1 + Math.random()) * 0x100000 | 0).toString(16).substring(1);

      Storage.prototype.localId2 = ((1 + Math.random()) * 0x100000 | 0).toString(16).substring(1);

      Storage.prototype.mid = function() {
        return ((new Date).getTime() / 1000 | 0).toString(16) + this.localId1 + this.localId2 + (++this.incrementId).toString(16).substring(1);
      };

      Storage.prototype.guid = function() {
        return this.s4() + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + this.s4() + this.s4();
      };

      Storage.prototype.save = function(item, options) {
        var _ref, _ref1, _ref2, _ref3;
        if (options == null) {
          options = {};
        }
        item.set({
          id: +((_ref = item.attributes) != null ? _ref.id : void 0) || +((_ref1 = item.attributes) != null ? _ref1.sid : void 0) || 'new'
        });
        item.set({
          sid: +((_ref2 = item.attributes) != null ? _ref2.sid : void 0) || +((_ref3 = item.attributes) != null ? _ref3.id : void 0) || 'new'
        });
        if (!options.local) {
          item.set({
            updated_at: (new Date()).toJSON(),
            dirty: true
          }, {
            silent: true,
            forceValidation: true
          });
        }
        this.replaceKeyFields(item, 'local');
        this.setItem("" + this.name + "-" + item.id, item);
        this.allIds.add(item.id);
        if (this.autoPush && !options.local) {
          this.sync.pushItem(item);
        }
        return item;
      };

      Storage.prototype.remove = function(item, options) {
        var id, sid, _ref, _ref1, _ref2;
        if (options == null) {
          options = {};
        }
        if (!((_ref = item.attributes) != null ? _ref.sid : void 0)) {
          id = options.id === 'mid' ? this.mid() : this.guid();
          item.set({
            sid: ((_ref1 = item.attributes) != null ? _ref1.sid : void 0) || ((_ref2 = item.attributes) != null ? _ref2.id : void 0) || 'new',
            id: id
          }, {
            silent: true
          });
        }
        this.removeItem("" + this.name + "-" + item.id);
        this.allIds.remove(item.id);
        sid = item.get('sid');
        if (this.autoPush && sid !== 'new' && !options.local) {
          this.sync.flushItem(sid);
        }
        return item;
      };

      Storage.prototype.isEmpty = function() {
        return this.getItem(this.name) === null;
      };

      Storage.prototype.clear = function() {
        var e;
        try {
          return IndexedDB.clear(this.name);
        } catch (_error) {
          e = _error;
        }
      };

      Storage.prototype.replaceKeyFields = function(item, method) {
        var collection, field, newValue, replacedField, wrapper, _ref, _ref1, _ref2;
        if (Offline.onLine()) {
          if (item.attributes) {
            item = item.attributes;
          }
          _ref = this.keys;
          for (field in _ref) {
            collection = _ref[field];
            replacedField = item[field];
            if (!/^\w{8}-\w{4}-\w{4}/.test(replacedField) || method !== 'local') {
              newValue = method === 'local' ? (wrapper = new Offline.Collection(collection), (_ref1 = wrapper.get(replacedField)) != null ? _ref1.id : void 0) : (_ref2 = collection.get(replacedField)) != null ? _ref2.get('sid') : void 0;
              if (!_.isUndefined(newValue)) {
                item[field] = newValue;
              }
            }
          }
        }
        return item;
      };

      return Storage;

    })();
    Offline.Sync = (function() {
      function Sync(collection, storage) {
        this.collection = new Offline.Collection(collection);
        this.storage = storage;
      }

      Sync.prototype.ajax = function(method, model, options) {
        if (Offline.onLine()) {
          this.prepareOptions(options);
          return Backbone.ajaxSync(method, model, options);
        } else {
          return localStorage.setItem('offline', 'true');
        }
      };

      Sync.prototype.full = function(name, options) {
        var _this = this;
        if (options == null) {
          options = {};
        }
        return this.ajax('read', this.collection.items, _.extend({}, options, {
          success: function(response, status, xhr) {
            var e, ids, item, _i, _len;
            _this.storage.clear();
            _this.collection.items.reset([], {
              silent: true
            });
            ids = [];
            for (_i = 0, _len = response.length; _i < _len; _i++) {
              item = response[_i];
              item.sid = item.id;
              ids.push(item.id);
            }
            try {
              if (name.length > 1) {
                IndexedDB.add(name, response, ids);
              }
            } catch (_error) {
              e = _error;
            }
            if (!options.silent) {
              _this.collection.items.trigger('reset');
            }
            if (options.success) {
              return options.success(response);
            }
          }
        }));
      };

      Sync.prototype.incremental = function(options) {
        if (options == null) {
          options = {};
        }
        return this.pull(_.extend({}, options));
      };

      Sync.prototype.prepareOptions = function(options) {
        var success,
          _this = this;
        if (localStorage.getItem('offline')) {
          localStorage.removeItem('offline');
          success = options.success;
          return options.success = function(response, status, xhr) {
            success(response, status, xhr);
            return _this.incremental();
          };
        }
      };

      Sync.prototype.pull = function(options) {
        var _this = this;
        if (options == null) {
          options = {};
        }
        return this.ajax('read', this.collection.items, _.extend({}, options, {
          success: function(response, status, xhr) {
            var e, ids, item, _i, _len;
            _this.collection.destroyDiff(response);
            ids = [];
            for (_i = 0, _len = response.length; _i < _len; _i++) {
              item = response[_i];
              item.sid = item.id;
              ids.push(item.id);
            }
            try {
              if (name.length > 1) {
                IndexedDB.add(name, response, ids);
              }
            } catch (_error) {
              e = _error;
            }
            _this.push();
            if (options.success) {
              return options.success(response);
            }
          }
        }));
      };

      Sync.prototype.createItem = function(item) {
        if (!_.include(this.storage.destroyIds.values, item.id.toString())) {
          item.sid = item.id;
          delete item.id;
          return this.collection.items.create(item, {
            local: true
          });
        }
      };

      Sync.prototype.updateItem = function(item, model) {
        if ((new Date(model.get('updated_at'))) < (new Date(item.updated_at))) {
          delete item.id;
          model.save(item, {
            local: true,
            silent: false
          });
        }
        if ((new Date(model.get('categoria_updated_at'))) < (new Date(item.categoria_updated_at))) {
          model.set({
            categoria_id: item.categoria_id,
            categoria_updated_at: item.categoria_updated_at
          });
          return model.save(null, {
            local: true,
            silent: false
          });
        }
      };

      Sync.prototype.push = function() {
        var item, sid, _i, _j, _len, _len1, _ref, _ref1, _results;
        _ref = this.collection.dirty();
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          item = _ref[_i];
          this.pushItem(item);
        }
        _ref1 = this.storage.destroyIds.values;
        _results = [];
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          sid = _ref1[_j];
          _results.push(this.flushItem(sid));
        }
        return _results;
      };

      Sync.prototype.pushItem = function(item) {
        var localId, method, _ref,
          _this = this;
        this.storage.replaceKeyFields(item, 'server');
        localId = item.id;
        delete item.attributes.id;
        _ref = item.get('sid') === 'new' ? ['create', null] : ['update', item.attributes.sid], method = _ref[0], item.id = _ref[1];
        this.ajax(method, item, {
          success: function(response, status, xhr) {
            if (method === 'create') {
              item.set({
                sid: response.id
              }, {
                silent: true
              });
            }
            return item.save({
              dirty: false
            }, {
              local: true,
              silent: true
            });
          }
        });
        item.attributes.id = localId;
        return item.id = localId;
      };

      Sync.prototype.flushItem = function(sid) {
        var model,
          _this = this;
        model = this.collection.fakeModel(sid);
        return this.ajax('delete', model, {
          success: function(response, status, xhr) {
            return _this.storage.destroyIds.remove(sid);
          },
          error: function(xhr, status, thrown) {
            if (+status.status === 404) {
              return _this.storage.destroyIds.remove(sid);
            }
          }
        });
      };

      return Sync;

    })();
    Offline.Index = (function() {
      function Index(name, storage) {
        var store;
        this.name = name;
        this.storage = storage;
        store = localStorage.getItem(this.name);
        this.values = (store && store.split(',')) || [];
      }

      Index.prototype.add = function(itemId) {
        if (itemId) {
          if (!_.include(this.values, itemId.toString())) {
            this.values.push(itemId.toString());
          }
        }
        return this.save();
      };

      Index.prototype.remove = function(itemId) {
        if (itemId) {
          this.values = _.without(this.values, itemId.toString());
        }
        return this.save();
      };

      Index.prototype.save = function() {
        return localStorage.setItem(this.name, this.values.join(','));
      };

      Index.prototype.reset = function() {
        this.values = [];
        return localStorage.removeItem(this.name);
      };

      return Index;

    })();
    return Offline.Collection = (function() {
      function Collection(items) {
        this.items = items;
      }

      Collection.prototype.dirty = function() {
        return this.items.where({
          dirty: true
        });
      };

      Collection.prototype.get = function(sid) {
        return this.items.find(function(item) {
          return item.get('sid') === sid || item.get('id') === sid;
        });
      };

      Collection.prototype.destroyDiff = function(response) {
        var diff, sid, _i, _len, _ref, _results;
        diff = _.difference(_.without(this.items.pluck('sid'), 'new'), _.pluck(response, 'id'));
        _results = [];
        for (_i = 0, _len = diff.length; _i < _len; _i++) {
          sid = diff[_i];
          _results.push((_ref = this.get(sid)) != null ? _ref.destroy({
            local: true
          }) : void 0);
        }
        return _results;
      };

      Collection.prototype.fakeModel = function(sid) {
        var model;
        model = new Backbone.Model({
          id: sid
        });
        model.urlRoot = this.items.url;
        return model;
      };

      return Collection;

    })();
  })(window, _, Backbone);

}).call(this);