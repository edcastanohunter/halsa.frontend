import { Directive } from '@angular/core';
import { classes } from '@halsa/ui/helm/utils';

@Directive({
  selector: '[hlmPopoverHeader],hlm-popover-header',
  exportAs: 'hlmPopoverHeader',
  host: { 'data-slot': 'popover-header' },
})
export class HlmPopoverHeader {
  constructor() {
    classes(() => 'flex flex-col gap-1 text-sm');
  }
}
