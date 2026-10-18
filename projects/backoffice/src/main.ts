import { bootstrapApplication } from '@angular/platform-browser';
import { loadAppConfig, renderBootstrapError } from '@halsa/core';
import { appConfig } from './app/app.config';
import { App } from './app/app';

loadAppConfig()
  .then((config) => bootstrapApplication(App, appConfig(config)))
  .catch(() => renderBootstrapError());
