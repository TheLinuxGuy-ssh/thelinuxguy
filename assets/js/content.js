/**
 * ===========================================================================
 *  ROHAN SHARMA (THELINUXGUY) PORTFOLIO
 *  THE SINGLE SOURCE OF TRUTH FOR EVERY PIECE OF CONTENT ON THIS WEBSITE
 * ===========================================================================
 *
 *  Every word, link, project, monologue, personal topic and label that the
 *  site renders is read from the single SITE_CONTENT object below. The
 *  renderer files contain ZERO content of their own - only structure:
 *
 *    Page                  Renderer                    Reads from this file
 *    --------------------  --------------------------  ------------------------
 *    index.html            assets/js/script.js         identity, navigation,
 *                                                      sections.*, posts,
 *                                                      projects, personal,
 *                                                      labels
 *    monologue/index.html  assets/js/monologue.js      meta, identity, posts,
 *                                                      pages.monologue
 *    topic/index.html      assets/js/topic.js          meta, identity, topics,
 *                                                      pages.topic
 *
 *  EDITING RECIPES (full walkthroughs live in README.md):
 *  - Add a project          -> append an object to "site.projects"
 *  - Add a monologue        -> append an object to "site.posts"
 *  - Add a personal topic   -> append to "site.personal" AND "site.topics"
 *  - Change stats / facts   -> edit "site.sections.about"
 *  - Reorder navigation     -> edit "site.navigation"
 *
 *  Escaping rules (what accepts HTML and what does not):
 *  - Most fields are escaped and rendered as plain text, so write plain text.
 *  - Plain HTML is intentional (rendered as is, as before) for exactly these:
 *      * every "heading" and "intro" of a section (supports <br> etc.)
 *      * site.posts[].content   (the full monologue body)
 *      * site.topics[].blocks[] with a "text" field (paragraphs)
 *  - The <title> and the social/OG meta tags inside each HTML file are
 *    static HTML for crawlers. They mirror values from "site.meta" and
 *    "site.identity"; keep them in sync by hand when you rename something.
 *
 *  IMPORT: the pages load assets/js/minified/*.js. After editing this file,
 *  run "npm run build" to regenerate them.
 */

export const SITE_CONTENT = {

  /* -----------------------------------------------------------------------
   * SITE META - constants about the site itself, not editorial content.
   * --------------------------------------------------------------------- */
  meta: {
    /** Canonical production origin; used for SEO + Open Graph URLs. */
    url: 'https://linuxguy.tech',

    /**
     * One-liner about the site. Mirrors the static og:description/
     * twitter:description tags in index.html, and feeds the OG card
     * image that "npm run build" generates. Edit both together.
     */
    description: 'Full Stack Developer and Solo Founder. Projects, writing and contact.',

    /**
     * Your logo/favicon file (at the repo root). index.html loads it as
     * the page icon, and the build embeds it inside the generated OG
     * image. Keep this in sync with the <link rel="icon"> href.
     */
    favicon: 'favicon.webp',

    /** Default social card image, relative to meta.url; generated at
     *  build time by scripts/build.mjs (name + description + logo). */
    ogImage: '/assets/media/og-image.png',

    /**
     * Personal pages are in "coming soon" mode until you say so: while
     * this is false the topic pages draw no images AND the Personal cards
     * hide their View buttons (without images those pages would only
     * repeat the card's note anyway). Topic social cards fall back to
     * the generated site card above instead of leaking a placeholder.
     * Flip to true and run "npm run build" when your real files are in.
     */
    showTopicImages: false,

    /**
     * Your GitHub handle. A project with a bare "github" value like "cv"
     * becomes https://github.com/TheLinuxGuy-ssh/cv automatically.
     */
    githubUser: 'TheLinuxGuy-ssh',
  },

  /* -----------------------------------------------------------------------
   * IDENTITY - the name + badge shown in the header of every page.
   * --------------------------------------------------------------------- */
  identity: {
    name: 'Rohan Sharma',
    badge: 'TheLinuxGuy',
  },

  /* -----------------------------------------------------------------------
   * NAVIGATION - the left-hand tab list of the main page.
   * Each entry maps to the <a data-target="..."> in index.html. The order
   * here is also the keyboard order (1-5, and With j/k arrows).
   */
  navigation: [
    { label: 'About', target: 'about' },
    { label: 'Monologues', target: 'monologues' },
    { label: 'Projects', target: 'projects' },
    { label: 'Personal', target: 'personal' },
    { label: 'Contact', target: 'contact' },
  ],

  /* -----------------------------------------------------------------------
   * SECTION CHROME (index.html) - the big heading + intro text shown at the
   * top of each navigation tab. The card *data* for each tab lives in the
   * matching top-level collection below (site.posts / site.projects /
   * site.personal) and is merged in by the renderer.
   */
  sections: {
    about: {
      /** Shown as the <h1>. Plain HTML allowed (the <br> is on purpose). */
      heading: 'I build software,<br> From interface to infrastructure.',

      /** The intro paragraph under the heading. Plain HTML allowed (<br><br>). */
      intro: "I'm a Full-Stack Developer, and Solo Founder who has been building cool stuff, ideating through a ton of strategies to find the best ones to solve the problems based on which I build my projects. I also own a full homelab comprising of two nodes currently. Very curious about new ideas, tech talks, discussions.<br><br> You can always view the personal and monologues section of the website to tune in with me if you'd like! Happy Browsing :)",

      /** The three big numbers in the bordered stats grid. */
      stats: [
        { value: '6+', label: 'Years building' },
        { value: '20+', label: 'Freelance clients' },
        { value: 'Top 5', label: 'Hack Club Summer of Code 2025' },
      ],

      /** The definition list under the stats grid. */
      facts: [
        { term: 'Role', detail: 'Founder at SkillHiive' },
        { term: 'Studying', detail: 'B.Tech Computer Science at VIT Bhopal' },
        { term: 'Clients', detail: 'India, US, EU and Brunei' },
      ],
    },

    monologues: {
      heading: 'Thinking out loud.',

      /**
       * The two sentences are intentionally kept on two lines here so the
       * generated HTML stays byte-identical to the original site.
       */
      intro: `Just a place where I express my thoughts which I feel to discuss or for the world hear.
        You are very much welcome to discuss about these topics with me anytime.`,
    },

    /** projects list lives in "site.projects" below. */
    projects: {
      heading: 'Things I have built.',

      /**
       * The good-first-issues panel beside the cards. It mirrors reality:
       * open issues labelled "good first issue" on your public repos are
       * pulled from GitHub's search API (one request, cached per visitor
       * for cacheMinutes). Nothing found -> the fallback line shows.
       */
      issues: {
        kicker: 'good first issues',
        blurb: 'want to build together? grab one of these and start talking.',
        fallback: 'no open doors right now — start one, label it good first issue, i will answer.',
        cacheMinutes: 30,
        max: 5,
      },
    },

    /** personal list lives in "site.personal" below. */
    personal: {
      heading: 'Outside the serious work.',
    },

    contact: {
      heading: "Let's build something.",

      /** The invitation text. Single line, <br><br> is intentional. */
      intro: "I have been building solo for most of my projects in all these years of my experience. Following that, I really look forward to collaborate on projects moving forward since I want to make better and finished projects which solve much bigger problems in the best ways as possible. <br><br>It doesn't matter as to how much expertise you have technically. If you have an idea, don't ever feel shy to reach me out!",

      /**
       * The three link rows. "handle" is the dimmed secondary text on the
       * right of each row.
       */
      links: [
        { label: 'GitHub', handle: 'TheLinuxGuy-ssh', url: 'https://github.com/TheLinuxGuy-ssh' },
        { label: 'Instagram', handle: '@the.linuxguy', url: 'https://instagram.com/the.linuxguy' },
        { label: 'LinkedIn', handle: 'thelinuxguy-ssh', url: 'https://linkedin.com/in/thelinuxguy-ssh' },
      ],

      /**
       * THE WALL - a curated guestbook at the bottom of the Contact tab.
       * Visitors sign it through the disturb card (wall mode: their ping
       * arrives titled 'new wall signature'); the ones you like you paste
       * here by hand as { alias, line } rows. Nothing publishes itself,
       * so the wall can never fill with spam.
       */
      wall: {
        heading: 'the wall',
        line: 'people have left marks. you can too.',
        empty: 'no marks yet — be the first.',
        sign: 'sign the wall →',
        hint: 'sign here — your line for the wall!',
        /** How a wall signature arrives on your phone. */
        pingTitle: 'new wall signature',
        pingTag: 'sparkles',
        /** The context line inside the message body. */
        context: 'the wall',
        entries: [
          // { alias: 'night owl', line: 'your mom.exe saved my semester' },
        ],
      },
    },
  },

  /* -----------------------------------------------------------------------
   * POSTS - every monologue, shown in the Monologues tab and on
   * monologue/index.html?p=<slug>.
   *
   *  id       incremental number, used only for bookkeeping
   *  slug     unique URL fragment (no spaces, keep it; links depend on it)
   *  title    card + page title (plain text)
   *  preview  the teaser paragraph on the card (plain text)
   *  content  the full article body as ONE HTML string - deliberately kept
   *           on a single line; write it with the <p>/<span class="important">
   *           markup style already used
   *  tags     optional: { name, accent } pairs for future filtering
   *  year     display year, e.g. "2026" (a string, shown with date)
   *  date     display date, e.g. "21 APRIL"
   */
  posts: [
  {
    id: 1,
    slug: "ai-and-human-thinking",
    title: "The actual impact of AI on the future of humans",
    preview: "In today's world, Ai is one of the hottest topics in the tech industry. OpenAI says that AI when fully ready will change the world in a positive way in every sector such as healthcare, programming, cybersecurity, etc.",
    content: "<p>In today's world, Ai is one of the hottest topics in the tech industry. <span class='important'>OpenAI</span> says that AI when fully ready will <span class='important'>change the world</span> in a <span class='important'>positive</span> way in every sector such as healthcare, programming, cybersecurity, etc. But, <span class='important'>there are two sides of a coin in the case of Ai here.</span> It's not something that everyone likes to point out that Ai will wipe us out like the terminator movie but actually it's quite different. <span class='beware'>Let's Begin.</span></p><br> <p>Have you ever noticed any <span class='important'>change</span> in people who use Ai models <span class='important'>extensively</span> these days? Honestly, It's like they can't even think of their baby's name at this point of time and use Ai for such simple tasks, <span class='important'>So just think about it for complex work purposes like coding.</span> See, the fact is, these days everyone is very much using and being <span class='beware'>dependent</span> towards Ai since it's <span class='important'>easier to fix a problem</span> in code or any issues quickly with it. Everyone wants the <span class='important'>quick way out of things</span> without any problem solving themselves, or as i call it, not <span class='highlight'>'Suffering Mentally'</span> towards solving something. Suppose for programmers, majority of them is shifting towards vibe coding where people mostly prompt the Ai model and make minor changes themselves which may sound good for time consumptions but it's the <span class='important'>mind and intellect</span> itself which will be the <span class='beware'>change.</span></p><p>For you to completely understand this, let me give you some context about Ai. It was made to only <span class='important'>automate the tasks</span> which the <span class='important'>industry and companies would benefit from </span> and where automation was very much needed, but OpenAI turned it into some chat application where any user can ask whatever they want which completely destroyed the principle of it's <span class='important'>safe use</span> and the whole industry moved towards using it without a second thought.</p> <p>Let me tell you something. In this time of the world, only the jobs having <span class='important'>repetitive tasks</span> are the ones what's being replaced which tells us that the job market is mainly focused on hiring people based on <span class='highlight'>intellect</span> since it's something an Ai Model cannot fully reach not matter <span class='important'>how developed it could turn out to be.</span> But, at the same time, intellect is all about experience and the suffering and thinking that comes with it in solving a problem. So when one skips that part and finds the solution through the datasets of an Ai. <span class='beware'>It kills that fuel required for a person's intellect to grow.</span> If it goes on to this rate, i assure you, everyone will slowly become the <span class='beware'>'Adult Child'</span> as they'll remain a child no matter how much they physically change or grow old, because they didn't face problems in life themselves. It's not that life is a full lone game, but there are moments you have to <span class='highlight'>fight alone.</span> When no one really is there.</p> <p class=\"important\">So, according to my theory, Ai will not kill us immediately, it will slowly kill out our power of thinking and reasoning. <span class='beware'>It will slowly kill the very thing that makes us human.</span> Leading to a 'dystopian' society where emotions would just be a made-up word. <span class='beware'>why?</span></p><p>Well its <span class='important'>not something i'm predicting</span>. It's something which is <span class='beware'>already happening.</span> I've seen countless people who have their so called Ai 'partners' with whom they feel satisfied with somehow even when they're not a real person. So many programmers nowadays exist who don't even remember the syntax of the language they code in and yet they still <span class='important'>call themselves a </span><span class='beware'>'coder'</span>. <span class='beware'>People taking life and financial advices from a literal Non-living being with just datasets.</span></p> <p>This is the exact reason why I consider it to be a <span class='beware'>mental pandemic</span> rather than a physical challenge to us. Even the 'GodFather of AI' <a href='https://en.wikipedia.org/wiki/Geoffrey_Hinton#:~:text=Geoffrey%20Hinton%20is%20distinguished%20for,testing%20originality%20and%20creative%20intelligence.' class='highlight' target='_blank'>Geoffrey Hinton</a> himself stated that Ai could be a <span class='important'>threat to human existence</span> if its <span class='highlight'>present situation continues.</span></p> <p>So, as per my own opinion, I stopped using Ai. I chose to have my freedom of suffering as a part of being a human if that's what it takes for me to actually live life. Yes, the world will change, but you have the power in your hands. It's totally up to you, but in my opinion, I do believe it's the real path to actually live your life. So if you believe me or your thoughts align with what i just explained and <span class='important'>You want to make something?</span> <span class='highlight'>Research it. Work on it. Take out the time to </span><span class='beware'>suffer.</div> <span class='important'>Period.</span> Because what doesn't kill you, just makes you</span> <span class='highlight'>stronger.</span> <span class='important'>That's the part about life, <span class='highlight'>happiness</span> as well as <span class='beware'>suffering</span>, both are equally important.</span> Also, <span class='important'>Remember that the jobs you see today in every field not just in tech, exist because they value or need something which only we as humans possess.</span> <span class='highlight'>Our intellect is why we think, reason and build and as for the job market, it is what we are hired for in this century.</span> <br> <span class='highlight'>NEW ADDITION</span> <br> <p>But <span class='beware'>there's a catch</span> if you do not use <span class='important'>AI</span> in today's world. you will eventually <span class='beware'>always be left behind.</span> Even the whole point of the tech industry has always been <span class='highlight'>adapt to the new technologies or be left behind.</span> It's a <span class='important'>never ending rabbithole</span> which has no end to it. Therefore, As i stated before, you can't really do much about it if you're in a field which can make the use of AI to solve things. Eventually, people will use it to their advancements and gain momentum and do stuff which will obviously <span class='important'>leave you behind in the competitive market.</span> All i can say is, <span class='highlight'>It's not about hard work now.</span> If you focus on doing stuff without AI, you will surely be left behind in your field but you'll have that <span class='important'>critical thinking</span> necessary for your personal development and Vice Versa. It's like you work hard on one end and you'll be left behind the other way. It's just a fact about the era we are living in, and there's not much you can really do about it. It's like you need <span class='important'>Ai to remain relevant</span> and earn for a normal living while you are just a <span class='beware'>mindless toaster living.</span> Otherwise you won't have the chances people have today.</p><p><span class='beware'>Let me be very clear.</span> We are living in a timestamp where it's <span class='important'>totally unpredictable</span> to say what's actually going to get you a living because as long as AI's growth continues, obviously it will <span class='beware'>start replacing jobs even in the creative ones.</span> Now as to why i say this is because the LLMs of today combined with the newly release <span class='important'>Claude by Anthropic</span> can <span class='important'>generate a lot of creatives stuff</span> on its own. From books to writing a whole project. So no matter how much you progress in your academic ladder, it will always be around the fact that even if the company needs you, it'll be <span class='highlight'>a whole lot less number of people who will be hired</span> in the first place because i believe the only problem with AI as of now is just that it's <span class='important'>not very reliable</span> when it comes to anything. So the people who would be hired for in the first place would be the ones who would be <span class='highlight'>in charge of making sure that AI is giving relevant outputs and meaningful responses</span> according to the company's needs.</p> <span>(New additions will be made to the blog in the future)</span></p><br> <p class='highlight'>Text me or mail me if you want to talk about the topic!</p>",
    tags: [
      {
        name: "Ai",
        accent: "#ffffff"
      },
      {
        name: "Future",
        accent: "#ffffff"
      }
    ],
    year: "2026",
    date: "21 APRIL"
  }
],

  /* -----------------------------------------------------------------------
   * PROJECTS - every entry of the Projects tab of the main page.
   *
   *  name    card title (plain text)
   *  type    the small uppercase tag in the card header (plain text)
   *  desc    the description paragraph (plain text, gets escaped)
   *  url     optional: live product link; adds the "Website" link
   *  github  optional: either a bare repo name (expanded against
   *          meta.githubUser) or a full URL; adds the "Source code" link
   */
  projects: [
  {
    name: "Mom.exe",
    type: "Web Application",
    desc: "Mom.exe is a wellness coach for students who moved out of the home where somebody else used to keep track of their life. You write what is going on in your own words, and it returns a concrete plan for the rest of the day and night.",
    url: "https://momexe.vercel.app",
    github: "mom.exe"
  },
  {
    name: "eDEX-CORE",
    type: "Electron Application",
    desc: "A cross-platform, science-fiction-themed workspace that fuses your terminal, editor, and browser into one resource-efficient environment, built for real work, not just a pretty cockpit.",
    github: "eDEX-CORE"
  },
  {
    name: "Aegies",
    type: "CLI Utility",
    desc: "A command-line tool for tracking Data Structures & Algorithms practice problems using a Leitner-system spaced-repetition schedule.",
    github: "aegies"
  },
  {
    name: "HyprAesthetic",
    type: "Web Application",
    desc: "Corrected sky brightness estimates from fused VIIRS satellite radiance and ground-truth observations. Quantifies LED light pollution invisible to every public map.",
    github: "hypraesthetic"
  },
  {
    name: "HyperPhish",
    type: "Web Application",
    desc: "An open-source phishing simulation platform for organizations and security educators. It delivers realistic login-page simulations across 47 major services.",
    url: "https://hyperphish.linuxguy.tech/",
    github: "https://git.linuxguy.tech/thelinuxguy/hyperphish"
  },
  {
    name: "Duskmeter",
    type: "Web Application",
    desc: "Corrected sky brightness estimates from fused VIIRS satellite radiance and ground-truth observations. Quantifies LED light pollution invisible to every public map.",
    url: "https://duskmeter.linuxguy.tech",
    github: "duskmeter"
  },
  {
    name: "CV",
    type: "Web Application",
    desc: "An ATS friendly CV template with single file config, built for the web and to be exported as a document on print.",
    url: "https://cv-bbe2.vercel.app/",
    github: "cv"
  },
  {
    name: "Sosh Media",
    type: "Website",
    desc: "A Creative Agency built for brands that actually have something to say."
  },
  {
    name: "StarWalk CA",
    type: "Unix Package / Daemon",
    desc: "A Shell based mTLS Certificate automation for orchestrating node setup, configuration, and lifecycle operations. (For Org Use Only)"
  },
  {
    name: "SkillHiive Stack",
    type: "Web + Mobile Application",
    desc: "Upcoming Web + Mobile Stack for SkillHiive."
  },
  {
    name: "Hyprfect",
    type: "Linux Dotfiles",
    desc: "Hyprland configuration for a clean, minimal arch linux setup!",
    github: "hyprfect"
  },
  {
    name: "The Spartan Rage",
    type: "2D Game",
    desc: "Kratos faces his next adventure in the egyptian mythology after his son walks on a different path.",
    url: "https://thelinuxguy-ssh.github.io/TheSpartanRage",
    github: "thespartanrage"
  },
  {
    name: "DarwinX",
    type: "Web Application",
    desc: "An online experience of macOS at the cost of nothing but Internet packets.",
    url: "https://darwinx.vercel.app",
    github: "darwinx"
  },
  {
    name: "ESP32 Irrigation Automation",
    type: "IoT",
    desc: "This project provides a soil moisture monitoring system using an ESP32 and a soil moisture sensor. The system reads moisture levels from the sensor and displays the readings.",
    github: "esp32irrigation"
  },
  {
    name: "Marine Consultancy Group",
    type: "Website",
    desc: "Marine Consultancy Services (MCS) is a design-driven marine consultancy firm supporting shipyards, vessel owners, and government agencies across India, Bangladesh, Sri Lanka, and Southeast Asia.",
    url: "https://www.shipconsultant.org"
  },
  {
    name: "Tagged",
    type: "Game",
    desc: "Co-op game where two players play tag to win!",
    url: "https://thelinuxguy-ssh.github.io/Tagged",
    github: "Tagged"
  },
  {
    name: "Global Insulation",
    type: "Website",
    desc: "An insulation company which supplies insulation material all over Victoria, Australia.",
    url: "https://www.globalinsulation.com.au"
  },
  {
    name: "TLG Start Page",
    type: "Web Application",
    desc: "Your Personal Browser Start Page from the Future!",
    url: "https://tlg-start-page.vercel.app/",
    github: "tlg-start-page"
  },
  {
    name: "TLG Links",
    type: "Web Application",
    desc: "A fork for TLG Start Page for specifically routing people through a set of personalised links in a presentable format.",
    url: "https://tlg-links.vercel.app/",
    github: "tlg-links"
  },
  {
    name: "Unite.Do",
    type: "Web Application",
    desc: "A Task management Web app for team management.",
    url: "https://unite-do.vercel.app",
    github: "unite.do"
  },
  {
    name: "DigiPod",
    type: "Website",
    desc: "A Landing page for an upcoming AI tool!",
    github: "DigiPod-Website"
  },
  {
    name: "COSMA2k24",
    type: "Website",
    desc: "An Inter-School Tech Event Website.",
    url: "https://thelinuxguy-ssh.github.io/COSMA2k24/"
  },
  {
    name: "Mahaveer International School",
    type: "Website",
    desc: "A website for Mahaveer International school, situated in north-west outskirt of historical city of Meerut.",
    url: "https://mismeerut.com/"
  },
  {
    name: "JP Academy",
    type: "Website",
    desc: "A website for a school which is a part of the JP Educational Trust Society laying its foundation in the educational field.",
    url: "https://jpacademy.in"
  },
  {
    name: "COSMA 2023",
    type: "Website",
    desc: "A website for an inter-school Tech Event.",
    url: "https://thelinuxguy-ssh.github.io/COSMA/"
  }
],

  /* -----------------------------------------------------------------------
   * PERSONAL - the numbered list in the Personal tab. Each item links to a
   * detail page built from "site.topics" by slugified title; a topic with
   * no matching entry in site.topics renders the "Page not found." page, so
   * keep both lists in sync.
   *
   *  title  the item heading (also drives the slug of its topic page)
   *  note   the paragraph text (plain text)
   */
  personal: [
  {
    title: "Homelab and Linux",
    note: "I have been working with two nodes at my homelab where one comprises a full-size desktop with i7-12700KF [Core] and the other is a raspberry pi 5 [Distal]. Both work parallel to each other. The raspberry pi is being used very cleverly because as you may know, it lacks the standard io speeds for a normal server. I use the [Core] server combined with TrueNas which gives the benefit of a full 1 gbps connection over the LAN"
  },
  {
    title: "Linux ricing",
    note: "This hobby has been one of most addicting things I have ever done. I have spent way too much time at this point in customising my linux desktops. I started all the way back from GNOME DE. Made countless GTK themes and widgets and then finally tried almost all DEs known to the linux community and finally settled for minimal builds for Hyprland + Waybar combined with AGS Shell + EWW for widgets."
  },
  {
    title: "Game development",
    note: "Not a field that I am skilled in particularly but, I just like to make some games whenever I have some free time because obviously they're fun :) hehe"
  },
  {
    title: "Pixel art",
    note: "I've spent way too much time on this because of game development as i used to make 2D pixel games and I was making a fully custom assets matrix-like game which I never released because I didn't really get the time in the period of time and so I abandoned the project. You won't find any traces of it anywhere except this website. It was quite a good looking game though based on the assets but it just didn't work out due to my schedule."
  },
  {
    title: "Poster and graphic design",
    note: "This hobby has always been the most creative one ever because I turned to be a natural at making actually great posters. I used to make really good posters in a single day of working on them and honestly I was shocked myself at the masterpieces that I made. The 'Viel' ones my favourite by the way."
  },
  {
    title: "Event production & Management",
    note: "Managed too many events at this point that It feels natural to me at this point. Smoothly executing programs with complex sequences, last minutes changes with an audience of 1200+ is just the best feeling if you ask me!"
  },
  {
    title: "Teaching",
    note: "I wouldn't say that I'm really good at explaining things very nicely. But, I try my best to explain concepts at the simplest level. And yes, It's all fully out of passion so I have put my heart into it honestly."
  },
  {
    title: "Hackathons",
    note: "Been to so many hackathons in the hopes of meeting new people, collaborate on project and winning the prizes and yet the only thing I have ever got are just prizes :)*"
  },
  {
    title: "Operating systems",
    note: "I specifically included this category because I have tried so many operating systems at this point. Everything from Windows, MacOS, Linux distros including every popularly known one like CutefishOS, Ubuntu, Kali, BlackArch, Arch, Arco, Alpine, and just so many more. and the fact is that it's not just about the operating systems that I have tried But, the fact that I actively switch way too smoothly between three operating system as I dual boot Asahi Linux and MacOS on an M1 Macbook while I additionally used windows occasionally according to my needs by accessing my remote server VMs specifically made for this purpose."
  }
],

  /* -----------------------------------------------------------------------
   * TOPICS - the detail pages opened via topic/index.html?p=<slug>.
   * The lead paragraph of a page is the matching personal item's note —
   * written ONCE in "personal" above and shown in both places. An optional
   * "summary" on a topic would override it (for standalone pages only).
   * The page body is an ordered list of blocks; the renderer supports:
   *
   *  { image: src, alt, caption, width, height }          image slot
   *  { images: [{ src, alt, caption, width, height }] }   gallery of slots
   *  { text: '...' }                                      paragraph in <p>
   *  { heading: '...' }                                   <h2>
   *  { links: [{ label, url }] }                          outbound links
   *
   * The nine pages below carry only image slots: drop your real files at
   * the same paths (any raster format works), update the extension in the
   * path if it changed, or delete a block for a slot you do not want.
   * While meta.showTopicImages is false (see above), nothing is drawn and
   * topic social cards fall back to the generated site card.
   */
  topics: [
  {
    slug: "homelab-and-linux",
    title: "Homelab and Linux",
    blocks: [
      { image: "assets/img/personal/homelab-and-linux/cover.svg", width: 1200, height: 630 }
    ]
  },

  {
    slug: "linux-ricing",
    title: "Linux ricing",
    blocks: [
      { image: "assets/img/personal/linux-ricing/cover.svg", width: 1200, height: 630 },
      { images: [
        { src: "assets/img/personal/linux-ricing/desktop.svg", width: 1200, height: 675 },
        { src: "assets/img/personal/linux-ricing/widgets.svg", width: 1200, height: 675 }
      ] }
    ]
  },

  {
    slug: "game-development",
    title: "Game development",
    blocks: [
      { image: "assets/img/personal/game-development/cover.svg", width: 1200, height: 630 },
      { images: [
        { src: "assets/img/personal/game-development/spartan-rage.svg", width: 1200, height: 675 },
        { src: "assets/img/personal/game-development/tagged.svg", width: 1200, height: 675 }
      ] }
    ]
  },

  {
    slug: "pixel-art",
    title: "Pixel art",
    blocks: [
      { image: "assets/img/personal/pixel-art/cover.svg", width: 1200, height: 630 },
      { images: [
        { src: "assets/img/personal/pixel-art/sprite-sheet.svg", width: 1200, height: 675 },
        { src: "assets/img/personal/pixel-art/tileset.svg", width: 1200, height: 675 }
      ] }
    ]
  },

  {
    slug: "poster-and-graphic-design",
    title: "Poster and graphic design",
    blocks: [
      { image: "assets/img/personal/poster-and-graphic-design/cover.svg", width: 900, height: 1200 },
      { images: [
        { src: "assets/img/personal/poster-and-graphic-design/viel.svg", width: 900, height: 1200 },
        { src: "assets/img/personal/poster-and-graphic-design/one-day-poster.svg", width: 900, height: 1200 }
      ] }
    ]
  },

  {
    slug: "event-production-management",
    title: "Event production & Management",
    blocks: [
      { image: "assets/img/personal/event-production-management/cover.svg", width: 1200, height: 630 }
    ]
  },

  {
    slug: "teaching",
    title: "Teaching",
    blocks: [
      { image: "assets/img/personal/teaching/cover.svg", width: 1200, height: 630 }
    ]
  },

  {
    slug: "hackathons",
    title: "Hackathons",
    blocks: [
      { image: "assets/img/personal/hackathons/cover.svg", width: 1200, height: 630 }
    ]
  },

  {
    slug: "operating-systems",
    title: "Operating systems",
    blocks: [
      { image: "assets/img/personal/operating-systems/cover.svg", width: 1200, height: 630 },
      { images: [
        { src: "assets/img/personal/operating-systems/asahi.svg", width: 1200, height: 675 },
        { src: "assets/img/personal/operating-systems/remote-vms.svg", width: 1200, height: 675 }
      ] }
    ]
  }
],

  /* -----------------------------------------------------------------------
   * LABELS - the reusable small link labels used inside the cards.
   */
  labels: {
    cardLinks: {
      /** Label for a project's live URL ("url" field). */
      website: 'Website',
      /** Label for a project's GitHub repo ("github" field). */
      sourceCode: 'Source code',
      /** Label on every monologue card. */
      read: 'Read',
      /** Label on every personal item. */
      view: 'View',
    },
  },

  /* -----------------------------------------------------------------------
   * PAGE CHROME - strings of the two detail pages (back links, title
   * suffixes and the "not found" screens).
   */
  pages: {
    monologue: {
      /** Back link into the main page (from a normal monologue page). */
      backLabel: '&larr; All monologues',
      backHref: '../index.html#monologues',

      /** Appended to document titles, e.g. "Title - TheLinuxGuy". */
      titleSuffix: ' - TheLinuxGuy',

      /** The not-found screen links back with "./" relative to its folder. */
      errorHref: './index.html#monologues',
      notFound: {
        title: 'Not found - TheLinuxGuy',
        heading: 'Monologue not found.',
        body: "That link doesn't match any monologue.",
        /** The ghost report: an invite to confess how they got here. */
        ghostLine: 'this page never existed. spooky.',
        ghostButton: 'tell me how you got here →',
      },
    },

    topic: {
      /** Back link + the little "Personal" kicker above the title. */
      backLabel: '&larr; Personal',
      backHref: '../index.html#personal',
      kicker: 'Personal',

      /** Appended to document titles, e.g. "Title | TheLinuxGuy". */
      titleSuffix: ' | TheLinuxGuy',

      notFound: {
        title: 'Not found | TheLinuxGuy',
        heading: 'Page not found.',
        body: "That link doesn't match any topic.",
        /** The ghost report: an invite to confess how they got here. */
        ghostLine: 'this page never existed. spooky.',
        ghostButton: 'tell me how you got here →',
      },
    },
  },

  /* -----------------------------------------------------------------------
   * PING - the bottom-right "disturb me" button, on every page.
   *
   * One click = an ntfy push to every device subscribed to `topic`. The
   * popover also takes an anonymous note; whichever page the visitor was
   * reading rides along inside the message body and becomes the tap-to-open
   * link of the notification.
   *
   * SETUP: install the ntfy app (phone or desktop), subscribe to exactly the
   * topic below, done. The topic name ships inside the bundle, so keep the
   * random suffix - anyone who digs it out can ping you too; if it ever
   * gets noisy, change the suffix here and run `npm run build` again.
   */
  ping: {
    /** Master switch (same pattern as meta.showTopicImages). */
    enabled: true,

    /** ntfy server; swap in your own instance whenever you like. */
    server: 'https://ntfy.sh',

    /** YOUR topic - subscribe to exactly this name in the ntfy app. */
    topic: 'thelinuxguy-hi-k7f2x9',

    /** Seconds one visitor has to wait between two successful pings. */
    cooldownSeconds: 30,

    /** Hard cap for the anonymous note (enforced by the input box). */
    maxNoteLength: 500,

    /** Emoji shortcodes ntfy shows next to the notification. */
    tags: 'wave,eyes',

    /** How a report sent from a not-found page differs from a normal ping. */
    ghost: {
      /** Prefilled note; the dead URL is appended at runtime. */
      note: 'I found a ghost page: ',
      title: 'ghost sighting reported 👻',
      tag: 'ghost',
    },

    /** Title line of the push notification. */
    notifyTitle: 'disturbance received 👋',

    /** Message body when someone just pings without typing anything. */
    quickBody: 'just a ping — no note, pure vibes.',

    /** Every visible string of the widget, editable like everything else. */
    labels: {
      button: 'disturb me 👋',
      heading: 'pssst...this will ping all my devices.',
      or: 'or',
      quickPing: 'just ping me →',
      placeholder: 'type it out!',
      send: 'send it →',
      sending: 'pinging…',
      sent: 'pinged! 🎉',
      failed: "didn't go through — try again?",
      homeContext: 'the home page',
      monologueContext: 'monologue',
      topicContext: 'personal',
      workWithMe: 'want to work with me? just disturb me at this point :)',
    },
  },
};
