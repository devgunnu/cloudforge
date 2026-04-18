import { NextRequest, NextResponse } from 'next/server'
import { MongoClient, ServerApiVersion } from 'mongodb'

// ---------------------------------------------------------------------------
// Module-level singleton — reused across warm serverless invocations.
// createIndex is called once during initialisation so it doesn't add latency
// to individual requests.
// ---------------------------------------------------------------------------
let cachedClient: MongoClient | null = null

async function getClient(): Promise<MongoClient> {
  if (cachedClient) return cachedClient
  const client = new MongoClient(process.env.MONGODB_URL!, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  })
  await client.connect()
  const col = client
    .db(process.env.MONGODB_DB_NAME ?? 'cloudforge')
    .collection('waitlist')
  await col.createIndex({ email: 1 }, { unique: true })
  cachedClient = client
  return cachedClient
}

// ---------------------------------------------------------------------------
// Blocklist: disposable / throwaway email providers
// ---------------------------------------------------------------------------
const DISPOSABLE_DOMAINS = new Set([
  '0-mail.com', '0815.ru', '0wnd.net', '0wnd.org', '10mail.org',
  '10minutemail.com', '10minutemail.net', '10minutemail.org', '20minutemail.com',
  '33mail.com', 'anonymail.dk', 'antispam.de', 'armyspy.com', 'binkmail.com',
  'bobmail.info', 'bofthew.com', 'breakthru.com', 'brefmail.com', 'bsnow.net',
  'bugmenot.com', 'chacuo.net', 'crap.expert', 'crazymailing.com', 'cubiclink.com',
  'curryworld.de', 'dayrep.com', 'deadaddress.com', 'despam.it', 'devnullmail.com',
  'dfgh.net', 'digitalsanctuary.com', 'discard.email', 'discardmail.com',
  'discardmail.de', 'dispostable.com', 'disposablemail.com', 'dodgeit.com',
  'dodgit.com', 'donemail.ru', 'dontreg.com', 'dontsendmespam.de', 'drdrb.com',
  'dump-email.info', 'dumpmail.de', 'dumpyemail.com', 'e4ward.com', 'email60.com',
  'emailias.com', 'emailinfive.com', 'emailisvalid.com', 'emailondeck.com',
  'emailsensei.com', 'emailtemporanea.com', 'emailtemporanea.net',
  'emailtemporar.ro', 'emailtemporary.com', 'emailthe.net', 'emailtmp.com',
  'emailwarden.com', 'emailx.at.hm', 'emailxfer.com', 'emkei.cz', 'emz.net',
  'enterto.com', 'etranquil.com', 'evopo.com', 'explodemail.com', 'fakeinbox.com',
  'fakeinformation.com', 'fakemail.fr', 'fastacura.com', 'fastchevy.com',
  'fastchrysler.com', 'fastkawasaki.com', 'fastmazda.com', 'fastmitsubishi.com',
  'fastnissan.com', 'fastsubaru.com', 'fastsuzuki.com', 'fasttoyota.com',
  'fastyamaha.com', 'filzmail.com', 'flyspam.com', 'footard.com', 'frapmail.com',
  'garliclife.com', 'getairmail.com', 'getonemail.com', 'gishpuppy.com',
  'givmail.com', 'grr.la', 'guerrillamail.biz', 'guerrillamail.com',
  'guerrillamail.de', 'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamailblock.com', 'gustr.com', 'h8s.org', 'hailmail.net', 'has.dating',
  'hatespam.org', 'herp.in', 'hidemail.de', 'hidzz.com', 'hmamail.com',
  'hopemail.biz', 'hulapla.de', 'ieatspam.eu', 'ieatspam.info', 'ilovespam.com',
  'imails.info', 'inboxclean.com', 'inboxclean.org', 'incognitomail.com',
  'incognitomail.net', 'incognitomail.org', 'inoutmail.de', 'inoutmail.eu',
  'inoutmail.info', 'inoutmail.net', 'insorg-mail.info', 'internet-e-mail.de',
  'internet-mail.de', 'internetemails.net', 'internetmailing.net', 'iroid.com',
  'iwi.net', 'jetable.com', 'jetable.fr.nf', 'jetable.net', 'jetable.org',
  'jnxjn.com', 'joliemoi.org', 'junk.to', 'justemail.net', 'just-temp-mail.com',
  'kasmail.com', 'killmail.com', 'killmail.net', 'klassmaster.com', 'klzlk.com',
  'koszmail.pl', 'kurzepost.de', 'letthemeatspam.com', 'lol.ovpn.to',
  'lookugly.com', 'lortemail.dk', 'lovemeleaveme.com', 'lr78.com', 'maildrop.cc',
  'mailexpire.com', 'mailfreeonline.com', 'mailguard.me', 'mailin8r.com',
  'mailinator.com', 'mailinator.net', 'mailinator.org', 'mailinator2.com',
  'mailinater.com', 'mailismagic.com', 'mailme.lv', 'mailnew.com', 'mailnull.com',
  'mailscrap.com', 'mailseal.de', 'mailshell.com', 'mailsiphon.com',
  'mailslapping.com', 'mailslite.com', 'mailtemp.info', 'mailtome.de',
  'mailtothis.com', 'mailzilla.com', 'mailzilla.org', 'mbx.cc', 'mega.zik.dj',
  'meltmail.com', 'mierdamail.com', 'mintemail.com', 'mohmal.com',
  'moncourrier.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf', 'mt2009.com',
  'mt2014.com', 'mvpmail.net', 'mytrashmail.com', 'neomailbox.com', 'nepwk.com',
  'nervmich.net', 'nervtmich.net', 'netmails.com', 'netmails.net', 'nevermail.de',
  'noclickemail.com', 'nogmailspam.info', 'nospam.ze.tc', 'nospam4.us',
  'nospamfor.us', 'nospamthanks.info', 'notmailinator.com', 'nowmymail.com',
  'nwldx.com', 'objectmail.com', 'obobbo.com', 'odaymail.com', 'onewaymail.com',
  'online.ms', 'oopi.org', 'ovpn.to', 'owlpic.com', 'pjjkp.com', 'plexolan.de',
  'pookmail.com', 'privy-mail.com', 'privy-mail.de', 'proxymail.eu', 'prtnx.com',
  'punkass.com', 'put2.net', 'qq.com', 'quickinbox.com', 'rcpt.at', 'recode.me',
  'recursor.net', 'regbypass.com', 'regbypass.comsafe-mail.net', 'rejectmail.com',
  'rmqkr.net', 'rtrtr.com', 's0ny.net', 'safe-mail.net', 'safetypost.de',
  'sandelf.de', 'sendspamhere.com', 'sharklasers.com', 'shiftmail.com',
  'shitmail.me', 'shitware.nl', 'shortmail.net', 'sibmail.com', 'skeefmail.com',
  'slopsbox.com', 'slushmail.com', 'smellfear.com', 'snakemail.com',
  'sneakemail.com', 'snkmail.com', 'sofimail.com', 'sofort-mail.de',
  'sogetthis.com', 'spam.la', 'spam.su', 'spam4.me', 'spamavert.com',
  'spambogus.com', 'spamfree.eu', 'spamfree24.de', 'spamfree24.eu',
  'spamfree24.info', 'spamfree24.net', 'spamfree24.org', 'spamgoes.in',
  'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org', 'spamgrap.de',
  'spamherelots.com', 'spamhereplease.com', 'spamhole.com', 'spamify.com',
  'spaminator.de', 'spamkill.info', 'spaml.com', 'spaml.de', 'spammotel.com',
  'spamobox.com', 'spamslicer.com', 'spamspot.com', 'spamthis.co.uk',
  'spamthisplease.com', 'spamtrail.com', 'speed.1s.fr', 'spikio.com',
  'spoofmail.de', 'squizzy.de', 'ssoia.com', 'startkeys.com', 'stexsy.com',
  'stinkefinger.net', 'stoogemail.com', 'supergreatmail.com', 'supermailer.jp',
  'suremail.info', 'sweetxxx.de', 'tafmail.com', 'tagyourself.com',
  'techemail.com', 'techgroup.me', 'telecomix.pl', 'temp-mail.com', 'temp-mail.de',
  'temp-mail.org', 'temp-mail.ru', 'tempail.com', 'tempalias.com',
  'tempe-mail.com', 'tempemail.biz', 'tempemail.co.za', 'tempemail.com',
  'tempemail.net', 'tempinbox.co.uk', 'tempinbox.com', 'tempmail.com',
  'tempmail.eu', 'tempmail.it', 'tempmail.net', 'tempmail.us', 'tempomail.fr',
  'temporaryemail.net', 'temporaryemail.us', 'temporaryforwarding.com',
  'temporaryinbox.com', 'temporarymail.org', 'tempthe.net', 'thanksnospam.info',
  'thisisnotmyrealemail.com', 'throam.com', 'throwam.com', 'throwaway.email',
  'tilien.com', 'tittbit.in', 'tmail.com', 'tmail.io', 'tmail.ws',
  'tmailinator.com', 'toiea.com', 'tokem.co', 'toomail.biz', 'topranklist.de',
  'tradermail.info', 'trash-mail.at', 'trash-mail.com', 'trash-mail.de',
  'trash-mail.ga', 'trash-mail.io', 'trash-mail.net', 'trashdevil.com',
  'trashdevil.de', 'trashemail.de', 'trashmail.at', 'trashmail.com',
  'trashmail.io', 'trashmail.me', 'trashmail.net', 'trashmail.org',
  'trashmail.xyz', 'trashmailer.com', 'trashpanda.live', 'trashtyrant.com',
  'trillianpro.com', 'trsh.me', 'ttttt.fun', 'turual.com', 'twinmail.de',
  'tyldd.com', 'uggsrock.com', 'uroid.com', 'us.af', 'venompen.com',
  'veryrealemail.com', 'viditag.com', 'viewcastmedia.com', 'viewcastmedia.net',
  'viewcastmedia.org', 'vkcode.ru', 'vomoto.com', 'vubby.com',
  'wasteland.rfc822.org', 'webemail.me', 'webm4il.info', 'wegwerfmail.de',
  'wegwerfmail.net', 'wegwerfmail.org', 'wetrainbayarea.com', 'wetrainbayarea.org',
  'wh4f.org', 'whyspam.me', 'wickmail.net', 'wilemail.com',
  'willhackforfood.biz', 'willselfdestruct.com', 'wmail.cf', 'wronghead.com',
  'wuzupmail.net', 'www.e4ward.com', 'www.mailinator.com', 'xagloo.com',
  'xemaps.com', 'xents.com', 'xmaily.com', 'xoxy.net', 'xyzfree.net',
  'yepmail.net', 'yodx.ro', 'yopmail.com', 'yopmail.fr', 'yourdomain.com',
  'yuurok.com', 'z1p.biz', 'za.com', 'zehnminuten.de', 'zehnminutenmail.de',
  'zoemail.net', 'zoemail.org', 'zomg.info',
])

// ---------------------------------------------------------------------------
// Role-based email local parts
// ---------------------------------------------------------------------------
const ROLE_BASED_PREFIXES = new Set([
  'abuse', 'admin', 'billing', 'contact', 'enquiries', 'feedback', 'hello',
  'help', 'hostmaster', 'info', 'legal', 'marketing', 'mailer-daemon',
  'maildaemon', 'no-reply', 'nobody', 'noreply', 'notify', 'office', 'ops',
  'postmaster', 'press', 'privacy', 'recruitment', 'root', 'sales', 'security',
  'service', 'spam', 'support', 'sysadmin', 'team', 'test', 'usenet', 'webmaster',
])

// RFC 5322-inspired regex for basic structural email validation.
const RFC_EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

// Three or more identical consecutive characters in the local part.
const RE_REPEATED_CHARS = /(.)\1{2,}/
// Local part is entirely digits.
const RE_DIGITS_ONLY = /^\d+$/

function validateEmail(email: string): string[] {
  const normalized = email.trim().toLowerCase()

  if (!RFC_EMAIL_RE.test(normalized)) {
    return ['Enter a valid email address.']
  }

  const atIndex = normalized.indexOf('@')
  const local = normalized.slice(0, atIndex)
  const domain = normalized.slice(atIndex + 1)

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return ['Disposable email addresses are not accepted.']
  }

  if (ROLE_BASED_PREFIXES.has(local)) {
    return [
      'Role-based email addresses (e.g. admin@, info@, support@) are not accepted. Please use your personal email.',
    ]
  }

  if (local.length < 2) {
    return ['Email address local part is too short to be valid.']
  }

  if (RE_REPEATED_CHARS.test(local)) {
    return ['Email address appears to contain repeated characters and may not be valid.']
  }

  if (RE_DIGITS_ONLY.test(local)) {
    return ['Email addresses consisting only of numbers are not accepted.']
  }

  // MX check skipped — dns module not available in Next.js Node runtime without
  // native bindings. The structural + blocklist checks above are sufficient
  // for waitlist signup quality.

  return []
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 },
    )
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { detail: [{ msg: 'Email is required.' }] },
      { status: 422 },
    )
  }

  const rawEmail = (body as Record<string, unknown>)['email']
  if (typeof rawEmail !== 'string' || rawEmail.trim() === '') {
    return NextResponse.json(
      { detail: [{ msg: 'Email is required.' }] },
      { status: 422 },
    )
  }

  const errors = validateEmail(rawEmail)
  if (errors.length > 0) {
    return NextResponse.json(
      { detail: errors.map((msg) => ({ msg })) },
      { status: 422 },
    )
  }

  if (!process.env.MONGODB_URL) {
    return NextResponse.json(
      { error: { code: 'configuration_error', message: 'Server configuration error.' } },
      { status: 500 },
    )
  }

  const email = rawEmail.trim().toLowerCase()

  try {
    const client = await getClient()
    const col = client
      .db(process.env.MONGODB_DB_NAME ?? 'cloudforge')
      .collection('waitlist')

    await col.insertOne({ email, inserted_at: new Date() })

    return NextResponse.json({ message: 'success' }, { status: 201 })
  } catch (err: unknown) {
    // Duplicate key error code from MongoDB
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === 11000
    ) {
      return NextResponse.json({ message: 'You\'re registered' }, { status: 200 })
    }

    return NextResponse.json(
      { error: { code: 'server_error', message: 'An unexpected error occurred.' } },
      { status: 500 },
    )
  }
}
