import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Check, Sparkles } from 'lucide-react';
import { useStore } from '../../store.js';
import type { LegalDoc } from '../../store.js';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  LEGAL / INFO PAGES — pricing, terms, privacy, refund.
 *  Required for payment-gateway (Tap Payments) approval of the site. Bilingual
 *  (Arabic first, English after) so both the client's users and the reviewing
 *  gateway can read them. Styled to match the desert landing (Home.tsx):
 *  black top bar + gold brand, white body, gold headings, yellow accents.
 *  Reached from the footer links on Home; `legalDoc` in the store picks the tab.
 * ════════════════════════════════════════════════════════════════════════════
 */

const GOLD = '#F4C73C';
const YELLOW = '#FFEA73';
const REDBTN = 'linear-gradient(180deg,#F2796C 0%,#E8473A 100%)';

const TABS: { id: LegalDoc; ar: string; en: string }[] = [
  { id: 'pricing', ar: 'الأسعار والباقات', en: 'Pricing' },
  { id: 'terms', ar: 'الشروط والأحكام', en: 'Terms' },
  { id: 'privacy', ar: 'سياسة الخصوصية', en: 'Privacy' },
  { id: 'refund', ar: 'الاسترداد والإلغاء', en: 'Refund' },
];

/** The four price packages (SAR). `save` is the crossed-out saving line. */
const PACKAGES = [
  { games: 'لعبة واحدة', gamesEn: '1 Game', price: 20, save: null, best: false },
  { games: 'لعبتان', gamesEn: '2 Games', price: 35, save: 'وفّر ٥ ريال', saveEn: 'Save 5 SAR', best: false },
  { games: '٥ ألعاب', gamesEn: '5 Games', price: 75, save: 'وفّر ٢٥ ريال', saveEn: 'Save 25 SAR', best: false },
  { games: '١٠ ألعاب', gamesEn: '10 Games', price: 100, save: 'وفّر ١٠٠ ريال', saveEn: 'Save 100 SAR', best: true },
];

export function Legal() {
  const { legalDoc, set } = useStore();

  // Land at the top whenever the document changes.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [legalDoc]);

  return (
    <div className="flex min-h-dvh flex-col bg-white text-desert-ink">
      {/* ─────────── Black top navbar (mirrors Home) ─────────── */}
      <header className="bg-desert-night">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-3 lg:px-8">
          <button
            onClick={() => set({ appView: 'home' })}
            className="font-display text-base font-extrabold tracking-wide transition hover:opacity-80 lg:text-lg"
            style={{ color: GOLD }}
          >
            البقاء للأقوى
          </button>
          <button
            onClick={() => set({ appView: 'home' })}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 font-display text-sm font-bold text-white transition hover:bg-white/20"
          >
            <ChevronRight size={16} /> الرئيسية
          </button>
        </div>
      </header>

      {/* ─────────── Tab bar ─────────── */}
      <nav className="sticky top-0 z-20 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1240px] gap-2 overflow-x-auto px-5 py-3 lg:px-8">
          {TABS.map((tab) => {
            const active = tab.id === legalDoc;
            return (
              <button
                key={tab.id}
                onClick={() => set({ legalDoc: tab.id })}
                className={`shrink-0 rounded-full px-4 py-2 font-display text-sm font-bold transition ${
                  active ? 'text-desert-ink shadow-sm' : 'text-desert-ink/50 hover:text-desert-ink'
                }`}
                style={active ? { backgroundColor: YELLOW } : undefined}
              >
                {tab.ar}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─────────── Document body ─────────── */}
      <main className="mx-auto w-full max-w-[860px] flex-1 px-5 pb-20 pt-8 lg:px-8">
        <motion.div
          key={legalDoc}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          {legalDoc === 'pricing' && <Pricing />}
          {legalDoc === 'terms' && <Terms />}
          {legalDoc === 'privacy' && <Privacy />}
          {legalDoc === 'refund' && <Refund />}
        </motion.div>
      </main>

      {/* ─────────── Slim footer ─────────── */}
      <footer className="bg-desert-night px-5 py-6 text-center text-xs text-white/45 lg:px-8">
        حقوق النشر © ٢٠٢٦ البقاء للأقوى. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}

/* ─────────────────────────── Shared blocks ─────────────────────────── */

function DocTitle({ ar, en }: { ar: string; en: string }) {
  return (
    <div className="mb-8 text-center">
      <h1 className="font-display text-3xl font-black text-desert-ink sm:text-4xl" style={{ color: '#1A1A1A' }}>
        {ar}
      </h1>
      <p className="mt-1 font-display text-base font-bold" style={{ color: '#C89A1E' }}>{en}</p>
      <span className="mx-auto mt-4 block h-1 w-20 rounded-full" style={{ backgroundColor: GOLD }} />
    </div>
  );
}

/** One clause: number badge + Arabic body, with the English translation beneath. */
function Clause({ n, title, ar, en }: { n: number; title?: string; ar: string; en: string }) {
  return (
    <li className="flex gap-4 rounded-2xl bg-white p-5 shadow-[0_14px_34px_-26px_rgba(0,0,0,0.5)] ring-1 ring-black/5">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-base font-black text-desert-ink"
        style={{ backgroundColor: YELLOW }}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        {title && <span className="mb-1 block font-display text-lg font-extrabold text-desert-ink">{title}</span>}
        <p dir="rtl" className="text-start text-[15px] leading-relaxed text-desert-ink/80">{ar}</p>
        <p dir="ltr" className="mt-2 border-t border-black/5 pt-2 text-start text-[13px] leading-relaxed text-desert-ink/45">
          {en}
        </p>
      </div>
    </li>
  );
}

function Intro({ ar, en }: { ar: string; en: string }) {
  return (
    <div className="mb-6 rounded-2xl p-5" style={{ backgroundColor: '#FFF7DA' }}>
      <p dir="rtl" className="text-start text-[15px] font-semibold leading-relaxed text-desert-ink/85">{ar}</p>
      <p dir="ltr" className="mt-2 text-start text-[13px] leading-relaxed text-desert-ink/50">{en}</p>
    </div>
  );
}

/* ─────────────────────────── 1 · Pricing ─────────────────────────── */

function Pricing() {
  const { set } = useStore();
  return (
    <>
      <DocTitle ar="قائمة الأسعار والباقات" en="Pricing List & Packages" />

      <div className="grid gap-5 sm:grid-cols-2">
        {PACKAGES.map((p, i) => (
          <motion.div
            key={p.gamesEn}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i, type: 'spring', stiffness: 240, damping: 20 }}
            className={`relative overflow-hidden rounded-[1.5rem] p-6 text-center shadow-[0_20px_46px_-28px_rgba(0,0,0,0.45)] ${
              p.best ? 'ring-2' : 'ring-1 ring-black/5'
            }`}
            style={{
              backgroundColor: p.best ? '#FFF7DA' : '#FFFFFF',
              // ring-2 colour for the best-value card
              ...(p.best ? { boxShadow: `0 0 0 2px ${GOLD}, 0 20px 46px -28px rgba(0,0,0,0.45)` } : {}),
            }}
          >
            {p.best && (
              <span
                className="absolute end-4 top-4 inline-flex items-center gap-1 rounded-full px-3 py-1 font-display text-xs font-black text-desert-ink"
                style={{ backgroundColor: GOLD }}
              >
                <Sparkles size={12} /> أفضل قيمة
              </span>
            )}
            <p className="font-display text-lg font-extrabold text-desert-ink">باقة {p.games}</p>
            <p className="text-sm text-desert-ink/45">{p.gamesEn} Package</p>
            <div className="mt-4 flex items-end justify-center gap-1.5">
              <span className="font-display text-5xl font-black text-desert-ink">{p.price}</span>
              <span className="mb-1.5 font-display text-lg font-bold text-desert-ink/70">ر.س</span>
            </div>
            {p.save ? (
              <p className="mt-2 font-display text-sm font-bold" style={{ color: '#1F9D55' }}>
                {p.save} · {p.saveEn}
              </p>
            ) : (
              <p className="mt-2 text-sm text-desert-ink/40">SAR {p.price}</p>
            )}
          </motion.div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm leading-relaxed text-desert-ink/50">
        تُضاف الباقة إلى رصيد حسابك فور إتمام الدفع، وتُستخدم لبدء ألعاب النسخة الكاملة (٣٥ سؤالاً مع اختيار الفئات).
      </p>

      <div className="mt-8 flex justify-center">
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => set({ appView: 'upgrade' })}
          className="rounded-full px-9 py-3 font-display text-base font-bold text-white shadow-[0_12px_26px_-12px_rgba(232,71,58,0.85)]"
          style={{ backgroundImage: REDBTN }}
        >
          فعّل النسخة الكاملة
        </motion.button>
      </div>
    </>
  );
}

/* ─────────────────────────── 2 · Terms ─────────────────────────── */

function Terms() {
  return (
    <>
      <DocTitle ar="الشروط والأحكام" en="Terms & Conditions" />
      <Intro
        ar={'مرحباً بكم في لعبة "البقاء للأقوى". بتنزيلك للعبة أو استخدامك للموقع، فإنك توافق على الالتزام بالشروط التالية:'}
        en={'Welcome to "Survival of the Fittest" game. By downloading the game or using our website, you agree to comply with the following terms:'}
      />
      <ol className="space-y-4">
        <Clause
          n={1}
          title="طبيعة الخدمة"
          ar={'"البقاء للأقوى" هي لعبة جماعية تنافسية تُعرض على الشاشات الذكية ويتم التحكم بها عبر الهواتف المحمولة.'}
          en={'Nature of Service: "Survival of the Fittest" is a competitive party game displayed on Smart TVs and controlled via mobile devices.'}
        />
        <Clause
          n={2}
          title="الحساب والأمان"
          ar="يتحمل المستخدم مسؤولية الحفاظ على سرية بيانات حسابه وأي أنشطة تتم من خلاله."
          en="Account Security: Users are entirely responsible for maintaining the confidentiality of their account data and all activities that occur under their account."
        />
        <Clause
          n={3}
          title="الاستخدام المقبول"
          ar="يتعهد المستخدم بعدم استخدام اللعبة في أي سلوك مسيء، أو محاولة اختراق نظام اللعبة، أو تعديل برمجياتها."
          en="Acceptable Use: Users agree not to engage in any abusive behavior, attempt to breach the game system, or modify its software."
        />
        <Clause
          n={4}
          title="الملكية الفكرية"
          ar={'جميع الحقوق، التصاميم، العلامات التجارية، والبرمجيات الخاصة بلعبة "البقاء للأقوى" هي ملكية حصرية تابعة لنا، ولا يحق إعادة استخدامها أو نسخها.'}
          en={'Intellectual Property: All rights, designs, trademarks, and software related to "Survival of the Fittest" are our exclusive property and may not be copied or reused.'}
        />
        <Clause
          n={5}
          title="التعديلات"
          ar="نحتفظ بالحق في تعديل هذه الشروط أو تحديث أسعار الباقات في أي وقت، وسيتم إخطار المستخدمين عبر التطبيق أو الموقع."
          en="Amendments: We reserve the right to modify these terms or update package prices at any time, and users will be notified through the app or website."
        />
      </ol>
    </>
  );
}

/* ─────────────────────────── 3 · Privacy ─────────────────────────── */

function Privacy() {
  return (
    <>
      <DocTitle ar="سياسة الخصوصية" en="Privacy Policy" />
      <Intro
        ar="نحن نلتزم بحماية خصوصية بياناتك وضمان سلامتها. توضح هذه السياسة كيف نجمع ونستخدم بياناتك:"
        en="We are committed to protecting your privacy and ensuring the security of your data. This policy explains how we collect and use your information:"
      />
      <ol className="space-y-4">
        <Clause
          n={1}
          title="البيانات التي نجمعها"
          ar="نجمع المعلومات الأساسية لإنشاء الحساب (مثل الاسم والبريد الإلكتروني)، وبيانات تشغيل اللعبة لربط الهواتف بالشاشة الذكية."
          en="Data Collection: We collect basic information required for account creation (such as name and email), and technical game session data to pair mobile phones with the Smart TV."
        />
        <Clause
          n={2}
          title="بيانات الدفع"
          ar="يتم معالجة جميع عمليات الدفع بشكل آمن ومشفر بالكامل عبر مزود خدمة الدفع المعتمد (Tap Payments)، ولا نقوم بحفظ أو تخزين أي بيانات لبطاقاتك الائتمانية في خوادمنا."
          en="Payment Data: All payment transactions are securely and fully encrypted through our authorized payment gateway (Tap Payments). We do not store or save any credit card details on our servers."
        />
        <Clause
          n={3}
          title="مشاركة البيانات"
          ar="نحن لا نبيع، ولا نتاجر، ولا نشارك بياناتك الشخصية مع أي أطراف ثالثة، وتُستخدم البيانات فقط لتحسين تجربة اللعب والدعم الفني."
          en="Data Sharing: We do not sell, trade, or share your personal data with any third parties. Data is solely used to enhance the gaming experience and provide technical support."
        />
      </ol>
    </>
  );
}

/* ─────────────────────────── 4 · Refund ─────────────────────────── */

function Refund() {
  return (
    <>
      <DocTitle ar="سياسة الاسترداد وإلغاء الاشتراك" en="Refund & Cancellation Policy" />
      <Intro
        ar={'نظراً لأن المنتجات والخدمات المقدمة في لعبة "البقاء للأقوى" هي حزم ومنتجات رقمية يتم تفعيلها وإضافتها إلى رصيد حساب المستخدم فوراً بمجرد إتمام عملية الدفع، فإننا نتبع السياسة التالية:'}
        en={'Since the services and products provided in "Survival of the Fittest" are digital game packages activated and credited to the user\'s account immediately upon successful payment, we apply the following policy:'}
      />
      <ol className="space-y-4">
        <Clause
          n={1}
          title="الحزم الرقمية"
          ar="جميع عمليات شراء باقات الألعاب (باقة ٢٠ ر.س، باقة ٣٥ ر.س، باقة ٧٥ ر.س، وباقة ١٠٠ ر.س) نهائية وغير قابلة للاسترداد أو الإلغاء بمجرد إتمام الدفع وإضافة الرصيد للحساب."
          en="Digital Goods: All purchases of game packages (20 SAR, 35 SAR, 75 SAR, and 100 SAR packages) are final and non-refundable or non-cancelable once the payment is processed and credit is added to the account."
        />
        <Clause
          n={2}
          title="الحالات الاستثنائية"
          ar="يتم النظر في طلبات الاسترداد فقط في حال وجود خلل تقني موثق في نظام الدفع تسبب في خصم المبلغ دون تفعيل الباقة المحددة في حساب المستخدم، وعجز فريق الدعم الفني عن حل المشكلة خلال ٤٨ ساعة."
          en="Exceptional Cases: Refund requests will only be reviewed if a documented technical issue occurs within the payment system that causes a deduction without activating the selected package, and our support team fails to resolve it within 48 hours."
        />
        <Clause
          n={3}
          title="الدعم الفني"
          ar="لتقديم أي استفسار بشأن المدفوعات أو الباقات، يرجى مراسلتنا عبر البريد الإلكتروني الرسمي المخصص للدعم."
          en="Support: For any payment or package inquiries, please reach out to us via our official support email."
        />
      </ol>

      <div className="mt-6 rounded-2xl p-5 text-center" style={{ backgroundColor: '#FFF7DA' }}>
        <span className="inline-flex items-center gap-2 font-display text-sm font-bold text-desert-ink">
          <Check size={16} style={{ color: '#1F9D55' }} /> support@albaqaa.app
        </span>
      </div>
    </>
  );
}
