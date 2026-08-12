import React, { useReducer, useEffect, useRef } from 'react';
import './BreathingExercise.css';

const PHASES = {
  IDLE: 'idle',
  READY: 'ready',
  INHALE: 'inhale',
  HOLD: 'hold',
  EXHALE: 'exhale',
  ROUND_COMPLETE: 'roundComplete',
  COMPLETE: 'complete'
};

const initialState = {
  phase: PHASES.IDLE,
  round: 1,
  timeRemaining: 0,
  isPaused: false,
};

function transitionPhase(state, overflow) {
  let nextPhase;
  let nextRound = state.round;
  let duration = 0;

  switch (state.phase) {
    case PHASES.IDLE:
      nextPhase = PHASES.READY;
      break;
    case PHASES.READY:
      nextPhase = PHASES.INHALE;
      break;
    case PHASES.INHALE:
      nextPhase = PHASES.HOLD;
      break;
    case PHASES.HOLD:
      nextPhase = PHASES.EXHALE;
      break;
    case PHASES.EXHALE:
      nextPhase = PHASES.ROUND_COMPLETE;
      break;
    case PHASES.ROUND_COMPLETE:
      if (state.round >= 4) {
        nextPhase = PHASES.COMPLETE;
      } else {
        nextPhase = PHASES.INHALE;
        nextRound = state.round + 1;
      }
      break;
    default:
      return state;
  }

  if (nextPhase === PHASES.READY) duration = 1000;
  else if (nextPhase === PHASES.INHALE) duration = 4000;
  else if (nextPhase === PHASES.HOLD) duration = 7000;
  else if (nextPhase === PHASES.EXHALE) duration = 8000;
  else if (nextPhase === PHASES.ROUND_COMPLETE) duration = nextRound >= 4 ? 2000 : 500;
  else if (nextPhase === PHASES.COMPLETE) duration = 0;

  return { ...state, phase: nextPhase, round: nextRound, timeRemaining: duration + overflow };
}

function reducer(state, action) {
  switch (action.type) {
    case 'START':
      return transitionPhase({ ...state, phase: PHASES.IDLE }, 0);
    case 'PAUSE':
      if (state.phase === PHASES.IDLE || state.phase === PHASES.COMPLETE) return state;
      return { ...state, isPaused: true };
    case 'RESUME':
      if (state.phase === PHASES.IDLE || state.phase === PHASES.COMPLETE) return state;
      return { ...state, isPaused: false };
    case 'TOGGLE_PAUSE':
      if (state.phase === PHASES.IDLE) return reducer(state, { type: 'START' });
      if (state.phase === PHASES.COMPLETE) return state;
      return { ...state, isPaused: !state.isPaused };
    case 'STOP':
      return { ...initialState };
    case 'TICK': {
      if (state.isPaused || state.phase === PHASES.IDLE || state.phase === PHASES.COMPLETE) return state;
      const newTime = state.timeRemaining - action.payload;
      if (newTime <= 0) {
        return transitionPhase(state, newTime);
      }
      return { ...state, timeRemaining: newTime };
    }
    default:
      return state;
  }
}

export default function BreathingExercise() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const lastTimeRef = useRef(performance.now());
  const requestRef = useRef(null);

  // Animation Loop
  const animate = (time) => {
    if (lastTimeRef.current !== undefined) {
      const delta = time - lastTimeRef.current;
      dispatch({ type: 'TICK', payload: delta });
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  // Update lastTimeRef when resuming to avoid huge delta jumps
  useEffect(() => {
    if (!state.isPaused) {
      lastTimeRef.current = performance.now();
    }
  }, [state.isPaused]);

  // Tab visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        dispatch({ type: 'PAUSE' });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_PAUSE' });
      } else if (e.code === 'KeyR') {
        dispatch({ type: 'STOP' });
        setTimeout(() => dispatch({ type: 'START' }), 0);
      } else if (e.code === 'Escape') {
        dispatch({ type: 'STOP' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Derived UI state
  const getPhaseLabel = () => {
    if (state.isPaused) return 'PAUSED';
    switch (state.phase) {
      case PHASES.IDLE: return 'TAP TO START';
      case PHASES.READY: return 'READY';
      case PHASES.INHALE: return 'INHALE';
      case PHASES.HOLD: return 'HOLD';
      case PHASES.EXHALE: return 'EXHALE';
      case PHASES.ROUND_COMPLETE: return '';
      case PHASES.COMPLETE: return 'COMPLETE';
      default: return '';
    }
  };

  const getAriaLabel = () => {
    if (state.phase === PHASES.IDLE) return "Breathing exercise, tap to start";
    if (state.phase === PHASES.COMPLETE) return "Breathing exercise complete";
    const seconds = Math.ceil(state.timeRemaining / 1000);
    const phaseText = getPhaseLabel();
    return `Breathing exercise, currently: ${phaseText}, ${seconds} seconds remaining.`;
  };

  const showDots = state.phase !== PHASES.IDLE && state.phase !== PHASES.COMPLETE;
  const showTimer = [PHASES.INHALE, PHASES.HOLD, PHASES.EXHALE].includes(state.phase);

  return (
    <div className={`container phase-${state.phase} ${state.isPaused ? 'paused' : ''}`}>
      <button 
        className="orb-button" 
        onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
        aria-label={getAriaLabel()}
      >
        <div className="orb">
          {state.isPaused && <div className="orb-overlay"></div>}
        </div>
      </button>

      <div 
        className="phase-label" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {getPhaseLabel()}
      </div>

      {showDots && (
        <div className="timer-display" aria-hidden="true">
          {showTimer ? Math.ceil(state.timeRemaining / 1000) : ''}
        </div>
      )}
      
      {state.phase === PHASES.IDLE && (
        <div className="hint-text">
          Space to start/pause • R to restart • Esc to stop
        </div>
      )}
    </div>
  );
}
