import { Header } from './Header'
import { Hero } from './Hero'
import { TrustRow } from './TrustRow'
import { FeatureGrid } from './FeatureGrid'
import { WorkflowSection } from './WorkflowSection'
import { ToolsSection } from './ToolsSection'
import { PricingSection } from './PricingSection'
import { FinalCta } from './FinalCta'
import { Footer } from './Footer'

export function LandingPage() {
  return (
    <div className="bg-background">
      <Header />
      <main>
        <Hero />
        <TrustRow />
        <FeatureGrid />
        <WorkflowSection />
        <ToolsSection />
        <PricingSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
