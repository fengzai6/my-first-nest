import { getConfig } from '@/config/configuration';
import type { SeqConfig } from '@/config/configuration.interface';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toClefLogEvent } from './clef';
import type { ILogEvent } from './interfaces/log.interface';

@Injectable()
export class SeqTransportService {
  private readonly config: SeqConfig;

  constructor(configService: ConfigService) {
    this.config = getConfig(configService).log.seq;
  }

  async send(events: readonly ILogEvent[]): Promise<void> {
    if (!this.config.enabled || events.length === 0) {
      return;
    }

    if (!this.config.url) {
      throw new Error('Seq URL is not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.serilog.clef',
    };
    if (this.config.apiKey) {
      headers['X-Seq-ApiKey'] = this.config.apiKey;
    }

    const response = await fetch(
      `${this.config.url.replace(/\/$/, '')}/ingest/clef`,
      {
        method: 'POST',
        headers,
        body: events
          .map(toClefLogEvent)
          .map((event) => JSON.stringify(event))
          .join('\n'),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      },
    );

    if (response.status !== 201) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(`Seq ingestion failed: ${response.status} ${body}`);
    }
  }
}
