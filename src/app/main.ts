import { Game } from './game';

/**
 * Entry point.
 *
 * Everything is bundled: there is no network request after install, which is
 * the brief's hardest constraint and the easiest to break by accident.
 */
const boot = async (): Promise<void> => {
  const stageRoot = document.getElementById('stage-root');
  const uiRoot = document.getElementById('ui-root');
  if (!stageRoot || !uiRoot) throw new Error('Missing mount points');

  const game = new Game();
  try {
    await game.start(stageRoot, uiRoot);
  } catch (err) {
    // Say so plainly rather than leaving a black screen. The message names
    // the actual error: an earlier version blamed the renderer for a failure
    // that was nothing to do with it.
    console.error('[boot] failed', err);
    uiRoot.innerHTML = `
      <div class="screen is-open">
        <div class="screen__inner">
          <div class="title">
            <h1 class="screen__heading">The lamp will not light</h1>
            <p class="screen__note">
              The game could not start on this device.
              ${String(err instanceof Error ? err.message : err)}
            </p>
          </div>
        </div>
      </div>`;
    return;
  }

  // Exposed for the automated browser smoke test only.
  (window as unknown as { __game?: Game }).__game = game;
};

void boot();
