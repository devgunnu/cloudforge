'use client';

import { motion } from 'framer-motion';
import PlanCard from '@/components/cloudforge/PlanCard';

export interface ChatMessage {
  id: string;
  role: 'agent' | 'user';
  content: string;
  timestamp: string;
  planCard?: {
    functional: string[];
    features: string[];
  };
}

interface ChatThreadProps {
  messages: ChatMessage[];
  isTyping?: boolean;
}

const messageVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function ChatThread({ messages, isTyping = false }: ChatThreadProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '24px 0',
      }}
    >
      {messages.map((message) =>
        message.role === 'agent' ? (
          <AgentMessage key={message.id} message={message} />
        ) : (
          <UserMessage key={message.id} message={message} />
        )
      )}
      {isTyping && <TypingIndicator />}
    </div>
  );
}

function AgentAvatar() {
  return (
    <div
      aria-hidden
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: 'var(--cf-purple-dim)',
        border: '0.5px solid var(--cf-purple-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--cf-purple)',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          lineHeight: 1,
        }}
      >
        CF
      </span>
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      aria-hidden
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: 'var(--lp-elevated)',
        border: '0.5px solid var(--lp-border-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: '10px',
          color: 'var(--lp-text-secondary)',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          lineHeight: 1,
        }}
      >
        GS
      </span>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Detect numbered list: if content has lines starting with "1."
  const lines = content.split('\n');
  const isNumberedList = lines.some((line) => /^\d+\./.test(line.trimStart()));

  if (isNumberedList) {
    // Split into pre-list text and list items
    const preLines: string[] = [];
    const listItems: string[] = [];
    let inList = false;

    for (const line of lines) {
      if (/^\d+\./.test(line.trimStart())) {
        inList = true;
        listItems.push(line.replace(/^\d+\.\s*/, '').trim());
      } else if (!inList) {
        preLines.push(line);
      }
    }

    const preText = preLines.join('\n').trim();

    return (
      <>
        {preText && <ContentText content={preText} />}
        {preText && <div style={{ height: '8px' }} />}
        <ol
          style={{
            paddingLeft: '18px',
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {listItems.map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: '14px',
                color: 'var(--lp-text-primary)',
                lineHeight: 1.6,
              }}
            >
              {item}
            </li>
          ))}
        </ol>
      </>
    );
  }

  return <ContentText content={content} />;
}

function ContentText({ content }: { content: string }) {
  // Render \n\n as double line breaks, \n as single
  const parts = content.split('\n\n');
  return (
    <>
      {parts.map((paragraph, pIdx) => (
        <span key={pIdx}>
          {paragraph.split('\n').map((line, lIdx, arr) => (
            <span key={lIdx}>
              {line}
              {lIdx < arr.length - 1 && <br />}
            </span>
          ))}
          {pIdx < parts.length - 1 && (
            <>
              <br />
              <br />
            </>
          )}
        </span>
      ))}
    </>
  );
}

function AgentMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      <AgentAvatar />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '540px' }}>
        <div
          style={{
            background: 'var(--lp-surface)',
            border: '0.5px solid var(--lp-border)',
            borderRadius: '0 12px 12px 12px',
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              color: 'var(--lp-text-primary)',
              lineHeight: 1.6,
            }}
          >
            <MessageContent content={message.content} />
          </div>
          {message.planCard && (
            <PlanCard
              functional={message.planCard.functional}
              features={message.planCard.features}
            />
          )}
        </div>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--lp-text-hint)',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
          }}
        >
          {message.timestamp}
        </span>
      </div>
    </motion.div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'flex',
        flexDirection: 'row-reverse',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      <UserAvatar />
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', maxWidth: '540px' }}
      >
        <div
          style={{
            background: 'var(--lp-accent-glow)',
            border: '0.5px solid var(--lp-accent-dim)',
            borderRadius: '12px 0 12px 12px',
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              color: 'var(--lp-text-primary)',
              lineHeight: 1.6,
            }}
          >
            <MessageContent content={message.content} />
          </div>
        </div>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--lp-text-hint)',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
          }}
        >
          {message.timestamp}
        </span>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      <AgentAvatar />
      <div
        style={{
          background: 'var(--lp-surface)',
          border: '0.5px solid var(--lp-border)',
          borderRadius: '0 12px 12px 12px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        aria-label="Agent is typing"
        role="status"
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="animate-pulse"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--lp-text-hint)',
              display: 'inline-block',
              animationDelay: `${delay}ms`,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
