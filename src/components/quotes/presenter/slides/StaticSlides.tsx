import {
  AlertTriangle,
  Award,
  Bell,
  Clock,
  Cloud,
  Droplet,
  Fuel,
  Gauge,
  Layers,
  Leaf,
  LineChart,
  Phone,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Wrench,
} from "lucide-react";
import {
  BigStatCircle,
  ComparisonTable,
  IconList,
  IncludedList,
  InfoCardGrid,
  SlideHeading,
  StatGrid,
  Timeline,
} from "@/components/quotes/presenter/slides/primitives";
import type { PresenterSlide } from "@/components/quotes/presenter/types";

/**
 * The ~19 non-personalized slides from the MarGav Heating x Intergas deck —
 * identical for every boiler quote. Split into `before` (everything up to
 * the personalized System Summary/Quotation/Monthly Cost slides) and the
 * closing `thankYou` slide, so `BoilerPresenter.tsx` can splice the
 * personalized slides into the right spot.
 */

function TitleSlide() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-brand-green-gradient p-16 text-center">
      <p className="text-sm font-semibold tracking-widest text-white/80 uppercase">MarGav Heating × Intergas</p>
      <h1 className="text-5xl font-bold text-white sm:text-6xl">Giving You Warmth You Can Trust</h1>
    </div>
  );
}

function ComparisonSlide() {
  return (
    <div>
      <SlideHeading title="Old Boiler vs Intergas Xclusive" subtitle="The same job, done very differently" />
      <ComparisonTable
        leftLabel="Old Boiler"
        rightLabel="Intergas Xclusive"
        rows={[
          { label: "Efficiency", left: "Drops year on year as parts wear", right: "A-rated, condenses ~100% of the time" },
          { label: "NOx emissions", left: "Often far above current standards", right: "Lowest NOx of any boiler on the market" },
          { label: "Warranty left", left: "Usually expired after 7-10 years", right: "12 years, parts & labour, from day one" },
          { label: "If the pump fails", left: "No hot water until it's fixed", right: "Hot water keeps running, no diverter valve" },
          { label: "Parts availability", left: "Harder and slower to source", right: "Current model, parts readily available" },
          { label: "Warranty support", left: "Chased through the original installer", right: "Handled directly by Intergas" },
        ]}
      />
    </div>
  );
}

function HomeCheckSlide() {
  return (
    <div>
      <SlideHeading title="Does Your Home Need This" subtitle="There are two simple questions to ask yourself." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-100 p-8">
          <Clock className="h-10 w-10 rounded-full bg-brand-blue p-2 text-white" />
          <p className="mt-4 text-sm font-semibold text-slate-500 uppercase">Q1.</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">Is your current boiler more than 10 years old?</p>
          <p className="mt-4 text-slate-500">
            History tells us, <span className="font-bold text-brand-blue">YES</span>
          </p>
        </div>
        <div className="rounded-xl bg-brand-blue p-8 text-white">
          <AlertTriangle className="h-10 w-10 rounded-full bg-white/20 p-2" />
          <p className="mt-4 text-sm font-semibold text-white/70 uppercase">Q2.</p>
          <p className="mt-1 text-lg font-semibold">Had a breakdown, rising bills, or an engineer flag hard-to-find parts?</p>
          <p className="mt-4 text-white/80">
            History tells us, <span className="font-bold">YES</span>
          </p>
        </div>
      </div>
      <p className="mt-6 text-center text-slate-600 italic">
        If that&rsquo;s you, it&rsquo;s worth having a proper look, before it fails on the coldest week of the year.
      </p>
    </div>
  );
}

function CostOfDoingNothingSlide() {
  return (
    <div>
      <SlideHeading title="The Cost Of Doing Nothing" subtitle="No invented figures here, just what tends to happen with an ageing boiler" />
      <IconList
        items={[
          { icon: Clock, title: "Falling efficiency", description: "Heat exchangers and components wear over time, so an old boiler works harder for the same warmth." },
          { icon: AlertTriangle, title: "Rising breakdown risk", description: "The older a boiler gets, the more likely a call-out becomes, often at the worst possible moment." },
          { icon: Wrench, title: "Harder to find parts", description: "Older models get discontinued. Repairs take longer and cost more once parts become scarce." },
          { icon: ShieldOff, title: "No warranty left", description: "Once the original manufacturer warranty runs out, you're covering every repair yourself." },
        ]}
      />
    </div>
  );
}

function FoundedOnInnovationSlide() {
  return (
    <div>
      <SlideHeading title="Founded on Innovation" subtitle="Intergas, the manufacturer behind every boiler we fit" />
      <ul className="flex flex-col gap-3 text-slate-700">
        <li>Headquartered in the Netherlands, with UK operations based in Kidderminster</li>
        <li>50 years&rsquo; experience in boiler technology</li>
        <li>In 1989, Intergas developed the ultimate condensing boiler, pioneering the bithermic heat exchanger still used today</li>
        <li>Simple, advanced engineering has stayed at the core of every model since</li>
      </ul>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-white">
        <span className="text-2xl font-bold">50</span>
        <span>years&rsquo; experience in boiler technology</span>
      </div>
    </div>
  );
}

function HistorySlide() {
  return (
    <div>
      <SlideHeading title="Our Strategic History" subtitle="Milestones that shaped the boiler we install in your home today" />
      <Timeline
        entries={[
          { marker: "1989", title: "The Ultimate Condensing Boiler", description: "Intergas pioneers the bithermic heat exchanger, condensing virtually 100% of the time, still the design at the heart of every model today." },
          { marker: "2017", title: "The Xclusive Range Launches", description: "Lowest NOx emissions of any boiler on the market at launch, a benchmark the range still holds today." },
          { marker: "Today", title: "Hybrid Technology & Net Zero", description: "Xtend hybrid technology pairs a gas boiler with an air source heat pump, cutting gas consumption by up to 82.5%, part of the journey toward net zero." },
        ]}
      />
    </div>
  );
}

function ProgressSlide() {
  return (
    <div>
      <SlideHeading title="Our Progress" subtitle="What five decades of boiler-only focus has produced" />
      <StatGrid
        stats={[
          { value: "50+", label: "Years of dedicated boiler technology experience", icon: LineChart },
          { value: "Lowest NOx", label: "Of any boiler on the market, Xclusive range", icon: Leaf },
          { value: "EST Endorsed", label: "Energy Saving Trust backs our HRE and Eco RF ranges", icon: Award },
          { value: "20% Hydrogen", label: "Ready technology built into the Xclusive today", icon: Droplet },
        ]}
      />
      <p className="mt-6 rounded-xl bg-brand-blue/10 p-5 text-slate-700">
        <span className="font-semibold">Working toward net zero.</span> 78% of UK homes are heated by gas,
        responsible for 14% of UK carbon emissions. Intergas&rsquo;s hybrid and hydrogen-ready technology is
        aimed squarely at that gap.
      </p>
    </div>
  );
}

function BuiltToLastSlide() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl bg-slate-100 p-8">
        <Layers className="h-10 w-10 rounded-full bg-brand-blue p-2 text-white" />
        <h3 className="mt-4 text-xl font-bold text-slate-900">Built to Last, Guaranteed to Deliver</h3>
        <p className="mt-3 text-slate-600">
          Made of aluminium and copper, and unlike most competitors&rsquo; two separate exchangers, the
          Xclusive&rsquo;s is bithermic, one unit with a greater surface area, built to condense for longer.
        </p>
      </div>
      <div className="rounded-xl bg-brand-blue p-8 text-white">
        <Droplet className="h-10 w-10 rounded-full bg-white/20 p-2" />
        <h3 className="mt-4 text-xl font-bold">Condenses virtually 100% of the time</h3>
        <p className="mt-3 text-white/80">
          The Xclusive condenses virtually 100% of the time it&rsquo;s producing hot water — an energy-saving
          feature that&rsquo;s genuinely hard to beat, backed by a 12-year parts &amp; labour warranty.
        </p>
      </div>
    </div>
  );
}

const SPEC_ROWS: { label: string; values: [string, string, string] }[] = [
  { label: "Heating rated output", values: ["18kW", "23kW", "27kW"] },
  { label: "NOx level", values: ["17.06 mg/kWh", "20.33 mg/kWh", "19.48 mg/kWh"] },
  { label: "DHW flow rate (ΔT 35°C)", values: ["10.2 l/min", "12.4 l/min", "13.5 l/min"] },
  { label: "Load profile", values: ["L", "XL", "XL"] },
  { label: "Max CH water pressure", values: ["2.5 bar", "2.5 bar", "2.5 bar"] },
  { label: "Energy efficiency class", values: ["A", "A", "A"] },
  { label: "Warranty", values: ["12 yrs*", "12 yrs*", "12 yrs*"] },
];

function SpecTableSlide() {
  return (
    <div>
      <SlideHeading title="The Intergas Xclusive Specification" />
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-4 bg-brand-blue text-white">
          <div className="p-3" />
          {["24", "30", "36"].map((size) => (
            <div key={size} className="p-3 text-center font-bold">
              {size}
            </div>
          ))}
        </div>
        {SPEC_ROWS.map((row, index) => (
          <div key={row.label} className={`grid grid-cols-4 ${index % 2 === 1 ? "bg-slate-50" : ""}`}>
            <div className="p-3 font-medium text-slate-700">{row.label}</div>
            {row.values.map((value, valueIndex) => (
              <div key={valueIndex} className="p-3 text-center text-slate-600">
                {value}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SizeOptionsSlide() {
  const sizes = [
    { name: "Xclusive 24", kw: "18kW", description: "Small-medium homes, 1 bathroom", accent: "bg-brand-green-mid" },
    { name: "Xclusive 30", kw: "23kW", description: "Medium homes, 2 bathrooms", accent: "bg-brand-blue" },
    { name: "Xclusive 36", kw: "27kW", description: "Larger homes, higher hot water demand", accent: "bg-brand-green-mid" },
  ];
  return (
    <div>
      <SlideHeading title="Choose Your Xclusive" subtitle="Three sizes, one boiler, matched to your home at survey" />
      <div className="flex flex-col gap-3">
        {sizes.map((size) => (
          <div key={size.name} className="flex overflow-hidden rounded-xl bg-slate-100">
            <div className={`w-2 ${size.accent}`} />
            <div className="flex flex-1 items-center justify-between gap-4 p-5">
              <div>
                <p className="font-bold text-slate-900">{size.name}</p>
                <p className="text-2xl font-bold text-brand-blue">{size.kw}</p>
              </div>
              <p className="text-right text-slate-600">{size.description}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 rounded-xl bg-brand-blue/10 p-5 text-slate-700">
        <span className="font-semibold">All three,</span> 12-year parts &amp; labour warranty, A-rated
        efficiency, lowest NOx on the market. Your engineer confirms the right size at survey.
      </p>
    </div>
  );
}

function PricingSimplySlide() {
  return (
    <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl sm:grid-cols-2">
      <div className="flex flex-col gap-6 bg-brand-blue p-10 text-white">
        <div>
          <h3 className="text-2xl font-bold">Your Xclusive, Priced Simply</h3>
        </div>
        <p className="text-5xl font-bold">£4,995</p>
        <p className="text-white/80">Boiler, standard flue &amp; Gateway with Comfort Touch</p>
        <div className="border-t border-white/20 pt-6">
          <IncludedList
            items={[
              "Xclusive 24, 30 or 36 (confirmed at survey)",
              "Gas Safe installation & Building Regs notification",
              "Removal & disposal of your old boiler",
              "12-year Intergas parts & labour warranty",
            ]}
          />
        </div>
      </div>
      <div className="flex flex-col gap-4 bg-slate-100 p-10">
        <h4 className="font-bold text-slate-900">Additional Options, If Required</h4>
        <p className="text-sm text-slate-500">Confirmed with you at survey, only if your installation needs them</p>
        {[
          { label: "Additional gas run", price: "£55 per metre" },
          { label: "Vertical flue", price: "£100 per metre" },
          { label: "Roof kit", price: "£150 one-off" },
        ].map((option) => (
          <div key={option.label} className="flex items-center justify-between rounded-lg bg-white p-4">
            <span className="font-semibold text-slate-900">{option.label}</span>
            <span className="font-bold text-brand-blue">{option.price}</span>
          </div>
        ))}
        <p className="mt-2 text-sm text-slate-500 italic">
          Every quote is confirmed in writing after survey, so you&rsquo;ll always know the full price before you
          agree to anything. Statutory 14-day cooling-off period applies once signed.
        </p>
      </div>
    </div>
  );
}

function ControlsSlide() {
  return (
    <div>
      <SlideHeading title="Controls & Smart Solutions" subtitle="The Gateway with Comfort Touch, our focus for every Xclusive installation" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {["White", "Black"].map((colour) => (
          <div key={colour} className="rounded-xl bg-slate-100 p-6">
            <p className="font-bold text-slate-900">Gateway with Comfort Touch</p>
            <p className="text-slate-500">{colour}</p>
            <p className="mt-4 rounded-full bg-brand-green-mid px-4 py-2 text-center text-sm font-semibold text-white">
              Compatible with all Intergas boilers
            </p>
          </div>
        ))}
      </div>
      <InfoCardGrid
        cards={[
          { icon: Smartphone, title: "Remote Control", description: "Adjust room temperature and weekly schedules from anywhere" },
          { icon: LineChart, title: "Real-Time Data", description: "View active boiler performance and system status" },
          { icon: Bell, title: "Fault Alerts", description: "Receive immediate notifications by app or email if a boiler error occurs" },
        ]}
      />
    </div>
  );
}

function KnowYourXclusiveSlide() {
  return (
    <div>
      <SlideHeading title="Know Your Xclusive" subtitle="Four things worth understanding about the boiler going into your home" />
      <InfoCardGrid
        cards={[
          { icon: Gauge, title: "Output & Sizing", description: "18–27kW across the 24, 30 and 36, sized to your home during the survey" },
          { icon: ShieldCheck, title: "Warranty & Cover", description: "12-year parts & labour warranty, handled directly by Intergas" },
          { icon: Leaf, title: "Efficiency & NOx", description: "A-rated efficiency, with the lowest NOx emissions of any boiler on the market" },
          { icon: Gauge, title: "Configurations", description: "Combi as standard, converts to a system boiler or multipoint water heater" },
        ]}
      />
    </div>
  );
}

function WarrantySlide() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <SlideHeading title="Your Warranty, Direct From Intergas" />
      <BigStatCircle value="12" label="Years. Parts & Labour Warranty" />
      <p className="max-w-xl text-slate-600 italic">
        Intergas handles your warranty claims directly. If an issue ever traces back to installation, they&rsquo;ll
        come to us, not you.
      </p>
    </div>
  );
}

function EnergyStatsSlide() {
  return (
    <div>
      <SlideHeading title="Gas & Energy in the UK" subtitle="The real, current numbers behind the conversation, not guesswork" />
      <StatGrid
        stats={[
          { value: "78%", label: "of UK homes are heated by a gas boiler", icon: Fuel },
          { value: "14%", label: "of UK carbon emissions come from home gas heating", icon: Cloud },
          { value: "£1,663/yr", label: "current Ofgem price cap for a typical dual-fuel home", icon: LineChart },
          { value: "7.3p", label: "per kWh, current Ofgem gas unit rate (Direct Debit)", icon: LineChart },
        ]}
      />
      <p className="mt-6 rounded-xl bg-brand-blue/10 p-5 text-slate-700">
        <span className="font-semibold">Prices remain well above pre-crisis levels.</span> Even after coming down
        from the 2022-23 energy crisis peak, the typical annual bill is still roughly 60% higher than the
        ~£1,000/year households paid before the crisis. Gas boiler efficiency matters more now than it used to.
      </p>
    </div>
  );
}

function RegisteredSlide() {
  return (
    <div>
      <SlideHeading title="Registered, Regulated" subtitle="The bodies that hold us to a standard, so you don't have to take our word for it" />
      <InfoCardGrid
        cards={[
          { icon: ShieldCheck, title: "Gas Safe Registered", description: "By law, only a Gas Safe registered engineer can install your gas boiler." },
          { icon: Award, title: "Benchmark Member", description: "Promotes quality installation, commissioning and servicing, in line with Building Regs." },
          { icon: Smartphone, title: "MiREG+ Registered", description: "Tested and approved by Gas Safe Register, with Building Regs notification paid on every job." },
        ]}
      />
    </div>
  );
}

function InstallationJourneySlide() {
  return (
    <div>
      <SlideHeading title="Your Installation Journey" />
      <Timeline
        entries={[
          { marker: "1", title: "Enquiry", description: "You get in touch, we ask a few questions" },
          { marker: "2", title: "Home Survey", description: "Free, no-obligation home visit" },
          { marker: "3", title: "Fixed Quotation", description: "One honest, written price" },
          { marker: "4", title: "Confirmed & Booked", description: "You decide, then we lock in a date" },
          { marker: "5", title: "Installation Day", description: "Usually done within a day" },
          { marker: "6", title: "Post-Install Check", description: "Full test, paperwork, walkthrough" },
          { marker: "7", title: "Ongoing Support", description: "Warranty registered, we're on hand" },
        ]}
      />
    </div>
  );
}

function SummaryBenefitsSlide() {
  return (
    <div>
      <SlideHeading title="Summary & Benefits" subtitle="Everything included when you choose Margav Heating" />
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h4 className="mb-3 border-b border-slate-200 pb-2 font-bold text-slate-900">Boiler Features</h4>
          <IncludedList
            tone="light"
            items={["A-rated, 18-30kW output", "Two-in-one heat exchanger", "Lowest NOx on the market", "12-year parts & labour warranty"]}
          />
        </div>
        <div>
          <h4 className="mb-3 border-b border-slate-200 pb-2 font-bold text-slate-900">Margav Service</h4>
          <IncludedList
            tone="light"
            items={["Gas Safe registered engineers", "Fixed, written price", "Aftercare support whenever you need us", "Warranty registered on your behalf"]}
          />
        </div>
      </div>
    </div>
  );
}

function ThankYouSlide() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-900 p-16 text-center text-white">
      <h1 className="text-5xl font-bold">Thank You</h1>
      <p className="max-w-lg text-white/70">
        Any questions at all, just ask your engineer, or get in touch with the office directly.
      </p>
      <p className="mt-4 flex items-center gap-2 text-lg font-semibold">
        <Phone className="h-5 w-5" /> 01889 256069 · www.margavheating.com
      </p>
    </div>
  );
}

export const STATIC_SLIDES_BEFORE: PresenterSlide[] = [
  { id: "title", node: <TitleSlide />, fullBleed: true },
  { id: "comparison", node: <ComparisonSlide /> },
  { id: "home-check", node: <HomeCheckSlide /> },
  { id: "cost-of-doing-nothing", node: <CostOfDoingNothingSlide /> },
  { id: "founded-on-innovation", node: <FoundedOnInnovationSlide /> },
  { id: "history", node: <HistorySlide /> },
  { id: "progress", node: <ProgressSlide /> },
  { id: "built-to-last", node: <BuiltToLastSlide /> },
  { id: "spec-table", node: <SpecTableSlide /> },
  { id: "size-options", node: <SizeOptionsSlide /> },
  { id: "pricing-simply", node: <PricingSimplySlide /> },
  { id: "controls", node: <ControlsSlide /> },
  { id: "know-your-xclusive", node: <KnowYourXclusiveSlide /> },
  { id: "warranty", node: <WarrantySlide /> },
  { id: "energy-stats", node: <EnergyStatsSlide /> },
  { id: "registered", node: <RegisteredSlide /> },
  { id: "installation-journey", node: <InstallationJourneySlide /> },
  { id: "summary-benefits", node: <SummaryBenefitsSlide /> },
];

export const THANK_YOU_SLIDE: PresenterSlide = { id: "thank-you", node: <ThankYouSlide />, fullBleed: true };
