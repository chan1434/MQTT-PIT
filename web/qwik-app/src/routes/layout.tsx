import { component$ } from '@builder.io/qwik';
import { Link, useLocation } from '@builder.io/qwik-city';

export default component$(() => {
  const location = useLocation();
  
  return (
    <div class="layout">
      <header class="header">
        <h1>RFID Access Control</h1>
        <nav class="nav">
          <Link 
            href="/" 
            class={location.url.pathname === '/' ? 'active' : ''}
          >
            Status
          </Link>
          <Link 
            href="/logs" 
            class={location.url.pathname === '/logs' ? 'active' : ''}
          >
            Logs
          </Link>
        </nav>
      </header>
      <main class="main">
        <slot />
      </main>
    </div>
  );
});

