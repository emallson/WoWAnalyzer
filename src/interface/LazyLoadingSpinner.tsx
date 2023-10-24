import DelayRender from 'interface/DelayRender';

interface LazyLoadingSpinnerProps {
  delay?: number;
}
export const LazyLoadingSpinner = ({ delay = 1000 }: LazyLoadingSpinnerProps) => (
  <DelayRender delay={delay}>
    <div className="spinner" style={{ fontSize: 5 }} />
  </DelayRender>
);
