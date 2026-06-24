import { DemoWindowChrome } from '../product-demo/demo-window-chrome';
import { PayrollDemoView } from '../product-demo/views/payroll-demo-view';
import { RecruitmentDemoView } from '../product-demo/views/recruitment-demo-view';
import { ShoutoutsDemoView } from '../product-demo/views/shoutouts-demo-view';

export type ShowcasePanelVariant = 'recruitment' | 'payroll' | 'culture';

export function LandingShowcasePanel({ variant }: { variant: ShowcasePanelVariant }) {
  return (
    <DemoWindowChrome className="shadow-xl shadow-black/20">
      <div className="max-h-[320px] overflow-hidden">
        {variant === 'recruitment' ? <RecruitmentDemoView compact /> : null}
        {variant === 'payroll' ? <PayrollDemoView compact /> : null}
        {variant === 'culture' ? <ShoutoutsDemoView compact /> : null}
      </div>
    </DemoWindowChrome>
  );
}
