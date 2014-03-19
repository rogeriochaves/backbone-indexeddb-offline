## About Backbone.indexeddb.offline

This library is a modified version of [ask11's Backbone.offline](https://github.com/ask11/backbone-offline)

The original library uses localstorage to persist data, but I built an application that had thousands and thousands of records to be stored offline, and localstorage was getting too slow

Backbone.indexeddb.offline should work exactly as [ask11's Backbone.offline](https://github.com/ask11/backbone-offline), so if you need any guidance, check Backbone.offline's guides. The only difference is that you need to include YDN-DB as well.

This library uses YDN-DB as a wrapper to IndexedDB, what makes everything A LOT easier, and, by using this library, you can than switch to WebSQL or WebStorage easily.