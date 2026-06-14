import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Decorator-First Streaming',
    icon: 'Stream',
    description: (
      <>
        Replace the cookbook's raw <code>@Res()</code> + manual piping with a
        single <code>@AiStream()</code> decorator. The handler just returns an AI
        SDK stream result.
      </>
    ),
  },
  {
    title: 'Full Enhancer Pipeline',
    icon: 'Nest',
    description: (
      <>
        Guards, pipes, interceptors, and exception filters all run before the
        stream opens, so a pre-stream rejection is an HTTP error, never an SSE
        error frame.
      </>
    ),
  },
  {
    title: 'Express + Fastify Parity',
    icon: 'Both',
    description: (
      <>
        The same handler streams identically on both adapters. The package
        writes to the underlying Node response and hijacks Fastify's reply so the
        AI SDK owns the socket.
      </>
    ),
  },
  {
    title: 'Real AbortSignal Plumbing',
    icon: 'Abort',
    description: (
      <>
        Inject <code>@AiAbortSignal()</code> and forward it into your AI SDK
        call. A client disconnect cancels the upstream model request so the
        provider stops billing — tested against real disconnects.
      </>
    ),
  },
  {
    title: 'Pre-Stream vs In-Stream Errors',
    icon: 'Errors',
    description: (
      <>
        Errors before the first byte become HTTP responses through your filters.
        Errors during the stream become the AI SDK's documented, secret-safe
        error frame.
      </>
    ),
  },
  {
    title: 'Zero Runtime Dependencies',
    icon: 'Zero',
    description: (
      <>
        The published package keeps <code>"dependencies": {}</code> empty. The AI
        SDK and NestJS packages stay peers, so your app installs only what it
        uses.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md feature-card">
        <div className={styles.featureIcon}>{icon}</div>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
