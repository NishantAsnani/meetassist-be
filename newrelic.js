// newrelic.js
'use strict'

exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME], // Give your app a clear name
  license_key: process.env.NEW_RELIC_LICENSE_KEY, 
  allow_all_headers: true,
  application_logging: {
    forwarding: {
      enabled: true
    }
  }
}