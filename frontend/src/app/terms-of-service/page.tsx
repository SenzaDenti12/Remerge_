import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-8 md:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient">Terms of Service</h1>
          <p className="mt-3 text-lg text-muted-foreground">Last Updated: May 17, 2025</p>
        </header>

        <article className="prose prose-lg dark:prose-invert mx-auto">
         

          <p className="lead">
            Welcome to ReMerge! These Terms of Service ("Terms") constitute a legally binding agreement made between you,
            whether personally or on behalf of an entity (“you” or “User”) and <strong>[Remerge]</strong>, doing business as ReMerge
            ("ReMerge", “we”, “us”, or “our”), concerning your access to and use of the remerge.com website as well as any other media form,
            media channel, mobile website or mobile application related, linked, or otherwise connected thereto, and the AI-powered
            video generation services, tools, and features offered (collectively, the “Service”).
          </p>
          <p>
            By accessing or using the Service, you acknowledge that you have read, understood, and agree to be bound by all of these Terms.
            If you do not agree with all of these Terms, then you are expressly prohibited from using the Service and you must
            discontinue use immediately.
          </p>

          <h2>1. DESCRIPTION OF SERVICE</h2>
          <p>
            ReMerge provides an online platform that utilizes artificial intelligence technologies to enable users to transform
            uploaded visual content (such as portrait images and background videos) and text scripts into new video content.
            Services include, but are not limited to, video analysis, script generation (automated or manual), voice synthesis,
            lip-sync animation, and final video rendering, potentially integrating with various third-party AI models and tools.
          </p>

          <h2>2. USER REGISTRATION AND ACCOUNTS</h2>
          <p>
            2.1. To access and use certain features of the Service, you must register for an account (“Account”). When you
            register for an Account, you agree to: (a) provide accurate, current, and complete information as may be
            prompted by any registration forms on the Service (“Registration Data”); (b) maintain the security of your
            password and identification; (c) maintain and promptly update the Registration Data, and any other information
            you provide to ReMerge, to keep it accurate, current, and complete; and (d) accept all risks of unauthorized
            access to the Registration Data and any other information you provide to ReMerge.
          </p>
          <p>
            2.2. You are responsible for all activities that occur under your Account. You agree to notify us immediately
            of any unauthorized use of your Account or any other breach of security. ReMerge will not be liable for any
            loss or damage arising from your failure to comply with this section.
          </p>
          <p>
            2.3. You must be at least 18 years old or the age of legal majority in your jurisdiction to create an Account
            and use the Service. If you are under the age of 18 or the applicable age of majority, you may only use the
            Service with the consent of your parent or legal guardian.
          </p>

          <h2>3. USER CONTENT AND CONDUCT</h2>
          <p>
            3.1. <strong>Your Content:</strong> You are solely responsible for all data, information, text, images, videos, audio, or other
            materials that you upload, post, publish, or display (hereinafter, “upload”) or email or otherwise use via
            the Service (“User Content”). This includes any avatar images, background videos, and scripts you provide.
            You represent and warrant that you own all rights to your User Content or, alternatively, that you have the
            right to give ReMerge the rights described below and that the User Content does not infringe the intellectual
            property rights, privacy rights, publicity rights, or any other legal or moral rights of any third party.
          </p>
          <p>
            3.2. <strong>License to User Content:</strong> By uploading User Content to the Service, you grant ReMerge a worldwide, non-exclusive,
            royalty-free, fully paid, sublicensable, and transferable license to use, host, store, reproduce, modify (for
            technical purposes, such as ensuring content is viewable on different devices or to prepare it for processing by AI models),
            create derivative works (such as those resulting from processing by our AI tools), communicate, publish, publicly perform,
            publicly display, and distribute such User Content solely for the purposes of operating, providing, developing, and
            improving the Service, and researching and developing new products and services. This license continues even if you stop using our Service,
            primarily for the purpose of allowing us to maintain your generated content if you choose, and for system integrity,
            unless you explicitly delete your content or account, subject to our data retention policies.
          </p>
          <p>
            3.3. <strong>Acceptable Use:</strong> You agree not to use the Service to upload, create, or distribute any User Content or Generated Content that:
            (a) is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, pornographic, invasive of another's privacy,
            hateful, or racially, ethnically, or otherwise objectionable;
            (b) infringes any patent, trademark, trade secret, copyright, or other proprietary rights of any party;
            (c) you do not have a right to transmit under any law or under contractual or fiduciary relationships;
            (d) contains software viruses or any other computer code, files, or programs designed to interrupt, destroy, or limit the
            functionality of any computer software or hardware or telecommunications equipment;
            (e) constitutes unsolicited or unauthorized advertising, promotional materials, "junk mail," "spam," "chain letters,"
            "pyramid schemes," or any other form of solicitation;
            (f) is designed to misinform, disinform, or impersonate any person or entity, or falsely state or otherwise
            misrepresent your affiliation with a person or entity;
            (g) could damage, disable, overburden, or impair the Service or interfere with any other party\'s use and enjoyment of the Service;
            (h) attempts to gain unauthorized access to the Service, other accounts, computer systems, or networks connected to the Service,
            through password mining or any other means.
          </p>
          <p>
            3.4. <strong>Content Moderation:</strong> ReMerge reserves the right, but has no obligation, to monitor User Content and Generated Content.
            We may, in our sole discretion, remove or refuse to process any content that we believe violates these Terms or is otherwise objectionable.
            While we previously employed automated moderation for scripts, such systems may be re-instated or modified at our discretion.
          </p>

          <h2>4. GENERATED CONTENT</h2>
          <p>
            4.1. <strong>Ownership and License:</strong> Subject to your compliance with these Terms and any applicable payment or subscription
            obligations, ReMerge grants you a worldwide, non-exclusive, royalty-free license to use, reproduce, distribute, display,
            and perform the final video content generated by the Service using your User Content (“Generated Content”) for your
            personal or commercial purposes, as permitted by your subscription tier.
          </p>
          <p>
            4.2. <strong>Responsibility for Generated Content:</strong> You acknowledge that the quality, accuracy, and appropriateness of Generated Content
            are dependent on your User Content and the current capabilities of the AI technologies used. ReMerge makes no warranties
            regarding the Generated Content, including its fitness for a particular purpose, non-infringement, or that it will meet
            your specific requirements. You are solely responsible for reviewing and ensuring that any Generated Content is suitable for
            your intended use and complies with all applicable laws and regulations.
          </p>
          <p>
            4.3. <strong>AI Limitations:</strong> The Service utilizes rapidly-evolving AI technologies. Outputs may be unpredictable, and AI-generated
            content may sometimes be inaccurate, biased, or reflect limitations or artifacts of the AI models. We are not responsible
            for any such characteristics of the Generated Content.
          </p>


          <h2>5. FEES, PAYMENTS, AND CREDITS</h2>
          <p>
            5.1. <strong>Subscription Plans and Credits:</strong> Access to certain features of the Service, or the generation of video content,
            may require an active subscription plan and/or the use of credits ("Credits"). Details of available subscription plans,
            their features, pricing, and the cost of Credits will be provided on the Service.
          </p>
          <p>
            5.2. <strong>Billing:</strong> By selecting a paid subscription plan or purchasing Credits, you agree to pay ReMerge the applicable fees.
            All payments will be processed through our third-party payment processor (Stripe). You agree to provide current, complete,
            and accurate purchase and account information for all purchases made via the Service. You further agree to promptly update
            account and payment information, including email address, payment method, and payment card expiration date, so that we can
            complete your transactions and contact you as needed.
          </p>
          <p>
            5.3. <strong>Recurring Billing:</strong> Subscription fees may be billed on a recurring basis (e.g., monthly or annually) as specified
            at the time of purchase. You authorize ReMerge to charge your chosen payment method on a recurring basis without requiring
            your prior approval for each recurring charge, until you cancel your subscription.
          </p>
          <p>
            5.4. <strong>Credit Usage:</strong> Credits are consumed when certain actions are performed, typically when a video generation job
            is processed by our backend systems, particularly involving calls to resource-intensive third-party AI services like
            LemonSlice. The specific actions that consume Credits and the number of Credits consumed will be indicated within the Service.
            Credits are non-refundable and have no monetary value outside the Service. Unused credits may expire according to the terms
            of your subscription or as otherwise stated.
          </p>
          <p>
            5.5. <strong>Free Tier/Initial Credits:</strong> New users may receive a one-time allotment of free Credits upon account creation.
            Currently, new users receive one (1) free Credit. This amount is subject to change at ReMerge\'s sole discretion.
          </p>
          <p>
            5.6. <strong>Changes to Pricing:</strong> ReMerge reserves the right to change its prices and credit system at any time. Price changes
            for subscriptions will take effect at the start of the next subscription period following the date of the price change.
          </p>
          <p>
            5.7. <strong>No Refunds:</strong> Except when required by law, all fees and charges are non-refundable.
          </p>

          <h2>6. INTELLECTUAL PROPERTY RIGHTS</h2>
          <p>
            6.1. <strong>Service Ownership:</strong> The Service, including its "look and feel" (e.g., text, graphics, images, logos), proprietary content,
            information and other materials, are protected under copyright, trademark, and other intellectual property laws. You agree that
            ReMerge and/or its licensors own all right, title, and interest in and to the Service (including any and all intellectual
            property rights therein) and you agree not to take any action(s) inconsistent with such ownership interests.
          </p>
          <p>
            6.2. <strong>Trademarks:</strong> ReMerge and all related graphics, logos, service marks, and trade names used on or in connection
            with the Service are the trademarks of ReMerge and may not be used without permission in connection with your or any
            third-party products or services. Other trademarks, service marks, and trade names that may appear on or in the Service
            are the property of their respective owners.
          </p>
          <p>
            6.3. <strong>Feedback:</strong> If you provide us with any feedback or suggestions regarding the Service (“Feedback”), you hereby assign
            to ReMerge all rights in such Feedback and agree that ReMerge shall have the right to use and fully exploit such Feedback
            and related information in any manner it deems appropriate. ReMerge will treat any Feedback you provide to us as
            non-confidential and non-proprietary.
          </p>

          <h2>7. THIRD-PARTY SERVICES</h2>
          <p>
            The Service relies on and integrates with various third-party services, including but not limited to:
            Supabase for authentication and database backend; Amazon Web Services (AWS S3) for file storage; Stripe for payment processing;
            Twelve Labs, OpenAI, LemonSlice, and Creatomate for AI-powered video processing, analysis, and generation.
            Your use of these third-party services may be subject to their respective terms of service and privacy policies.
            ReMerge is not responsible for the operation of, or any changes to, these third-party services, or for any loss or
            damage incurred as a result of your use of such services.
          </p>

          <h2>8. TERM AND TERMINATION</h2>
          <p>
            8.1. <strong>Term:</strong> These Terms will remain in full force and effect while you use the Service.
          </p>
          <p>
            8.2. <strong>Termination by You:</strong> You may terminate your Account at any time by [Describe Account Deletion Process - e.g., contacting us, through account settings if available].
          </p>
          <p>
            8.3. <strong>Termination by ReMerge:</strong> We may suspend or terminate your rights to use the Service (including your Account) at any time
            for any reason at our sole discretion, including for any use of the Service in violation of these Terms. Upon termination
            of your rights under these Terms, your Account and right to access and use the Service will terminate immediately.
            You understand that any termination of your Account may involve deletion of your User Content and Generated Content
            associated therewith from our live databases. ReMerge will not have any liability whatsoever to you for any
            termination of your rights under these Terms, including for termination of your Account or deletion of your User Content.
          </p>

          <h2>9. DISCLAIMER OF WARRANTIES</h2>
          <p>
            THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW,
            REMERGE EXPRESSLY DISCLAIMS ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING,
            BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
          </p>
          <p>
            REMERGE MAKES NO WARRANTY THAT (A) THE SERVICE WILL MEET YOUR REQUIREMENTS; (B) THE SERVICE WILL BE UNINTERRUPTED,
            TIMELY, SECURE, OR ERROR-FREE; (C) THE RESULTS THAT MAY BE OBTAINED FROM THE USE OF THE SERVICE (INCLUDING AI-GENERATED
            CONTENT) WILL BE ACCURATE, RELIABLE, COMPLETE, OR UP-TO-DATE; OR (D) THE QUALITY OF ANY PRODUCTS, SERVICES, INFORMATION,
            OR OTHER MATERIAL PURCHASED OR OBTAINED BY YOU THROUGH THE SERVICE WILL MEET YOUR EXPECTATIONS.
          </p>

          <h2>10. LIMITATION OF LIABILITY</h2>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL REMERGE, ITS AFFILIATES, OR THEIR RESPECTIVE
            OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO, DAMAGES FOR LOSS OF PROFITS, REVENUE,
            INCOME, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES (EVEN IF REMERGE HAS BEEN ADVISED OF THE POSSIBILITY OF
            SUCH DAMAGES), RESULTING FROM: (A) THE USE OR THE INABILITY TO USE THE SERVICE; (B) THE COST OF PROCUREMENT OF
            SUBSTITUTE GOODS AND SERVICES RESULTING FROM ANY GOODS, DATA, INFORMATION, OR SERVICES PURCHASED OR OBTAINED OR
            MESSAGES RECEIVED OR TRANSACTIONS ENTERED INTO THROUGH OR FROM THE SERVICE; (C) UNAUTHORIZED ACCESS TO OR
            ALTERATION OF YOUR TRANSMISSIONS OR DATA; (D) STATEMENTS OR CONDUCT OF ANY THIRD PARTY ON THE SERVICE; OR (E) ANY
            OTHER MATTER RELATING TO THE SERVICE.
          </p>
          <p>
            OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR USE OF THE SERVICE,
            WHETHER IN CONTRACT, TORT, OR OTHERWISE, SHALL NOT EXCEED THE GREATER OF (I) THE AMOUNT YOU HAVE PAID TO REMERGE FOR
            ACCESS TO AND USE OF THE SERVICE IN THE SIX (6) MONTHS PRIOR TO THE EVENT GIVING RISE TO THE CLAIM, OR (II) ONE
            HUNDRED U.S. DOLLARS (USD $100.00).
          </p>

          <h2>11. INDEMNIFICATION</h2>
          <p>
            You agree to defend, indemnify, and hold harmless ReMerge, its affiliates, and their respective officers, directors,
            employees, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs or debt,
            and expenses (including but not limited to attorney\'s fees) arising from: (a) your use of and access to the Service;
            (b) your violation of any term of these Terms; (c) your violation of any third-party right, including without
            limitation any copyright, property, or privacy right; or (d) any claim that your User Content or Generated Content
            caused damage to a third party. This defense and indemnification obligation will survive these Terms and your use of the Service.
          </p>

          <h2>12. GOVERNING LAW AND DISPUTE RESOLUTION</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of <strong>[Massachusetts]</strong>,
            without regard to its conflict of law principles. Any legal suit, action, or proceeding arising out of or related to
            these Terms or the Service shall be instituted exclusively in the federal or state courts located in
            <strong>[Boston, MA]</strong>, and you irrevocably submit to the exclusive jurisdiction of such courts
            in any such suit, action, or proceeding.
          </p>
          <p>
          </p>

          <h2>13. CHANGES TO TERMS</h2>
          <p>
            ReMerge reserves the right, at its sole discretion, to modify or replace these Terms at any time. If a revision
            is material, we will make reasonable efforts to provide at least [e.g., 30 days\'] notice prior to any new terms
            taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to
            access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
            If you do not agree to the new terms, in whole or in part, please stop using the website and the Service.
            We will indicate the "Last Updated" date at the top of these Terms.
          </p>

          <h2>14. MISCELLANEOUS</h2>
          <p>
            14.1. <strong>Entire Agreement:</strong> These Terms constitute the entire agreement between you and ReMerge regarding the use of the Service,
            superseding any prior agreements between you and ReMerge relating to your use of the Service.
          </p>
          <p>
            14.2. <strong>Severability:</strong> If any provision of these Terms is held to be invalid or unenforceable, such provision shall be struck
            and the remaining provisions shall be enforced to the fullest extent under law.
          </p>
          <p>
            14.3. <strong>Waiver:</strong> The failure of ReMerge to enforce any right or provision of these Terms will not be deemed a waiver of
            such right or provision.
          </p>
          <p>
            14.4. <strong>Assignment:</strong> You may not assign these Terms or any of your rights or obligations hereunder, whether by operation of law or
            otherwise, without ReMerge\'s prior written consent, and any attempted assignment without such consent will be null and void.
            ReMerge may assign these Terms or any of its rights or obligations hereunder without your consent.
          </p>
          <p>
            14.5. <strong>Headings:</strong> The section titles in these Terms are for convenience only and have no legal or contractual effect.
          </p>

          <h2>15. CONTACT INFORMATION</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
            <br />
            <strong>ReMerge</strong>
            <br />
            <br />
            Email: testremerge@gmail.com
          </p>
        </article>

        <div className="mt-12 text-center">
          <Link href="/" className="text-primary hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
} 