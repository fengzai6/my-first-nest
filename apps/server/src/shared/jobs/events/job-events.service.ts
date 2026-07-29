import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter } from 'rxjs';
import { IJobSseEvent } from '../types/job.types';

@Injectable()
export class JobEventsService {
  private readonly events$ = new Subject<IJobSseEvent>();
  private sequence = 0;

  publish(event: Omit<IJobSseEvent, 'id'>): IJobSseEvent {
    const nextEvent: IJobSseEvent = {
      ...event,
      id: String(++this.sequence),
    };

    this.events$.next(nextEvent);
    return nextEvent;
  }

  subscribe(jobId: string): Observable<IJobSseEvent> {
    return this.events$.asObservable().pipe(
      filter((event) => {
        return event.data.id === jobId;
      }),
    );
  }
}
