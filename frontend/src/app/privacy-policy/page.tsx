import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-8 md:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient">Privacy Policy</h1>
          <p className="mt-3 text-lg text-muted-foreground">Last Updated: May 17, 2025</p>
        </header>

        <article className="prose prose-lg dark:prose-invert mx-auto">
          <div className="p-4 mb-6 border-l-4 border-red-500 bg-red-500/10">
            
              
          </div>

          <p className="lead">
            <strong>Remerge</strong>, doing business as ReMerge ("ReMerge", "we", "us", "our"), is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website
            remerge.com, including any other media form, media channel, mobile website, or mobile application related or connected
            thereto (collectively, the "Site") and use our AI-powered video generation services (the "Service"). Please read this
            privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the Site or Service.
          </p>

          <h2>1. INFORMATION WE COLLECT</h2>
          <p>
            We may collect personal information from you in a variety of ways. The personal information we may collect depends on the
            content and features you use, and includes:
          </p>
          <p>
            <strong>1.1. Information You Provide to Us:</strong>
            <ul>
              <li>
                <strong>Account Information:</strong> When you register for an account, we collect your email address and password.
                You may optionally provide other profile information.
              </li>
              <li>
                <strong>User Content:</strong> We collect the content you upload to the Service, including avatar images, background videos,
                and text scripts ("User Content"). This content is processed to provide the Service.
              </li>
              <li>
                <strong>Payment Information:</strong> When you make a purchase (e.g., subscribe to a plan or buy credits), our third-party
                payment processor, Stripe, collects your payment card information. We do not directly store your full payment card
                details, but we may receive transaction details and limited card information (e.g., last four digits, card type) from Stripe.
              </li>
              <li>
                <strong>Communications:</strong> If you contact us directly (e.g., for customer support), we may receive additional
                information about you such as your name, email address, phone number, the contents of the message and/or
                attachments you may send us, and any other information you may choose to provide.
              </li>
            </ul>
          </p>
          <p>
            <strong>1.2. Information We Collect Automatically When You Use the Service:</strong>
            <ul>
              <li>
                <strong>Log and Usage Data:</strong> Like most websites and online services, we automatically collect log and usage data when you
                access and use our Service. This information can include your IP address, browser type, operating system, device information,
                referring/exit pages, pages viewed, date/time stamps, and clickstream data.
              </li>
              <li>
                <strong>Job Data and Generated Content:</strong> We collect and store information related to your use of the video generation
                features, including job IDs, parameters used for generation (e.g., selected voice, script modifications), status updates,
                summaries generated by services like Twelve Labs, and the final AI-generated videos ("Generated Content") and associated
                metadata (e.g., S3 object keys, thumbnail URLs).
              </li>
              <li>
                <strong>Cookies and Similar Tracking Technologies:</strong> We use cookies and similar tracking technologies (like Google Analytics)
                to track user activity on our Service and hold certain information. Cookies are small data files stored on your hard drive
                or in device memory that help us improve our Service and your experience, see which areas and features of our Service
                are popular, and count visits. You can instruct your browser to refuse all cookies or to indicate when a cookie is being
                sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
                For more information on how we use cookies with Google Analytics, please see their policies.
              </li>
            </ul>
          </p>
          <p>
            <strong>1.3. Information from Third Parties:</strong>
            <ul>
              <li>
                <strong>Authentication Services:</strong> We use Supabase for user authentication. If you authenticate using Supabase,
                we receive information from them such as your user ID and email.
              </li>
              <li>
                <strong>Payment Processors:</strong> As mentioned, Stripe processes payments and provides us with transaction data.
              </li>
            </ul>
          </p>

          <h2>2. HOW WE USE YOUR INFORMATION</h2>
          <p>We use the information we collect for various purposes, including to:</p>
          <ul>
            <li>Provide, operate, maintain, and improve our Service;</li>
            <li>Process your transactions, manage your account, and send you related information, including purchase confirmations and invoices;</li>
            <li>Personalize and improve your experience on the Service;</li>
            <li>Enable you to create, manage, and share User Content and Generated Content;</li>
            <li>Communicate with you, including responding to your comments, questions, and requests, and providing customer service and support;</li>
            <li>Send you technical notices, updates, security alerts, and support and administrative messages;</li>
            <li>Monitor and analyze trends, usage, and activities in connection with our Service to improve its functionality and user experience;</li>
            <li>Detect, investigate, and prevent fraudulent transactions, unauthorized access to the Service, and other illegal activities;</li>
            <li>Comply with legal obligations and enforce our terms and policies;</li>
            <li>For research and development of new products and services, and to improve our AI models (though we will prioritize de-identification or aggregation where feasible for such purposes).</li>
          </ul>

          <h2>3. HOW WE SHARE YOUR INFORMATION</h2>
          <p>We may share your personal information in the following situations:</p>
          <ul>
            <li>
              <strong>With Service Providers:</strong> We share information with third-party vendors, consultants, and other service providers
              who perform services on our behalf or help us operate our Service. This includes:
              <ul>
                <li><strong>Cloud Hosting:</strong> Amazon Web Services (AWS S3 for storage), [Your Hosting Provider, e.g., Vercel, Render] for application hosting.</li>
                <li><strong>Authentication & Database:</strong> Supabase.</li>
                <li><strong>Payment Processing:</strong> Stripe.</li>
                <li>
                  <strong>AI Processing Services:</strong>
                  <ul>
                    <li>OpenAI (for script generation/enhancement).</li>
                    <li>Twelve Labs (for video analysis and summarization, thumbnail generation).</li>
                    <li>LemonSlice (for voice synthesis and lip-sync animation).</li>
                    <li>Creatomate (for final video rendering and composition).</li>
                  </ul>
                </li>
                <li><strong>Analytics Providers:</strong> Google Analytics.</li>
                <li><strong>Email Delivery Services:</strong> [If you use a specific service for transactional emails, list it here, e.g., SendGrid, Postmark].</li>
              </ul>
              These service providers will have access to your personal information only to perform these tasks on our behalf and
              are obligated not to disclose or use it for any other purpose. We endeavor to ensure these providers have appropriate
              data protection measures.
            </li>
            <li>
              <strong>For Legal Reasons:</strong> We may disclose your information if we believe it's necessary to comply with a legal obligation
              (e.g., subpoena, court order), protect and defend our rights or property, prevent fraud, protect the safety of our users
              or the public, or protect against legal liability.
            </li>
            <li>
              <strong>Business Transfers:</strong> If ReMerge is involved in a merger, acquisition, financing due diligence, reorganization, bankruptcy,
              receivership, sale of company assets, or transition of service to another provider, your information may be sold or
              transferred as part of such a transaction as permitted by law and/or contract.
            </li>
            <li>
              <strong>With Your Consent:</strong> We may share your information with your consent or at your direction.
            </li>
          </ul>
          <p>
            We do not sell your personal information to third parties.
          </p>

          <h2>4. DATA RETENTION</h2>
          <p>
            We retain personal information we collect from you where we have an ongoing legitimate business need to do so (for example,
            to provide you with a service you have requested or to comply with applicable legal, tax, or accounting requirements).
          </p>
          <p>
            Specifically:
            <ul>
              <li><strong>Account Information:</strong> Retained as long as your account is active and for a reasonable period thereafter in case you
              decide to re-activate the Service, or as necessary for our legitimate business interests, or to comply with our legal obligations.</li>
              <li><strong>User Content (Uploaded Avatars, Videos, Scripts):</strong> Retained on our active systems (e.g., AWS S3) as long as your account is active
              or until you delete the specific content or your account, subject to backup and archival processes.</li>
              <li><strong>Generated Content (Final Videos, Thumbnails):</strong> Stored in our systems (e.g., AWS S3, Supabase for metadata) and made available to you
              through your account. Retained similarly to User Content.</li>
              <li><strong>Job Data (parameters, intermediate results, logs):</strong> May be retained for a period to allow for service operation, debugging,
              improvement, and analytics. We will endeavor to anonymize or aggregate this data where feasible for longer-term analysis.</li>
            </ul>
          </p>
          <p>
            When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize it or,
            if this is not possible (for example, because your personal information has been stored in backup archives), then we will
            securely store your personal information and isolate it from any further processing until deletion is possible.
          </p>

          <h2>5. DATA SECURITY</h2>
          <p>
            We have implemented appropriate administrative, technical, and physical security measures designed to protect the security
            of any personal information we process. These measures include, for example, encryption where appropriate, access controls,
            and secure software development practices. However, despite our safeguards and efforts to secure your information, no
            electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we
            cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat
            our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect
            your personal information, transmission of personal information to and from our Service is at your own risk. You should
            only access the Service within a secure environment.
          </p>

          <h2>6. YOUR DATA PROTECTION RIGHTS</h2>
          <p>
            Depending on your location and applicable data protection laws (e.g., GDPR for EEA/UK residents, CCPA for California residents),
            you may have the following data protection rights:
          </p>
          <ul>
            <li>The right to <strong>access</strong> – You have the right to request copies of your personal data.</li>
            <li>The right to <strong>rectification</strong> – You have the right to request that we correct any information you believe is inaccurate or complete information you believe is incomplete.</li>
            <li>The right to <strong>erasure</strong> – You have the right to request that we erase your personal data, under certain conditions.</li>
            <li>The right to <strong>restrict processing</strong> – You have the right to request that we restrict the processing of your personal data, under certain conditions.</li>
            <li>The right to <strong>object to processing</strong> – You have the right to object to our processing of your personal data, under certain conditions.</li>
            <li>The right to <strong>data portability</strong> – You have the right to request that we transfer the data that we have collected to another organization, or directly to you, under certain conditions.</li>
            <li>The right to <strong>withdraw consent</strong> – If we are processing your personal information based on your consent, you have the right to withdraw your consent at any time.</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us at testremerge@gmail.com or through the contact information provided below.
            We will respond to your request in accordance with applicable data protection laws. We may need to verify your identity
            before processing your request.
          </p>
          <p>
          </p>

          <h2>7. INTERNATIONAL DATA TRANSFERS</h2>
          <p>
            Your information, including personal data, may be transferred to — and maintained on — computers located outside of your
            state, province, country, or other governmental jurisdiction where the data protection laws may differ from those in your
            jurisdiction. If you are located outside the United States and choose to provide information to us, please note that we
            transfer the data, including personal data, to the United States and process it there. Your consent to this Privacy Policy
            followed by your submission of such information represents your agreement to that transfer.
          </p>
          <p>
            ReMerge will take all steps reasonably necessary to ensure that your data is treated securely and in accordance with this
            Privacy Policy and no transfer of your personal data will take place to an organization or a country unless there are
            adequate controls in place including the security of your data and other personal information.
          </p>
          <p>
          </p>

          <h2>8. CHILDREN'S PRIVACY</h2>
          <p>
            Our Service is not directed to individuals under the age of 13 (or a higher age threshold as required by applicable law in your jurisdiction),
            and we do not knowingly collect personal information from children under 13. If we become aware that a child under 13
            has provided us with personal information, we will take steps to delete such information from our files as soon as possible.
            If you are a parent or guardian and believe your child has provided us with personal information without your consent,
            please contact us.
          </p>

          <h2>9. LINKS TO OTHER WEBSITES</h2>
          <p>
            Our Service may contain links to other websites that are not operated by us. If you click on a third-party link, you will
            be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit.
            We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party
            sites or services.
          </p>

          <h2>10. CHANGES TO THIS PRIVACY POLICY</h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on
            this page and updating the "Last Updated" date at the top of this Privacy Policy. You are advised to review this Privacy
            Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
            For material changes, we may provide more prominent notice (such as by adding a statement to our homepage or sending you a notification).
          </p>

          <h2>11. CONTACT US</h2>
          <p>
            If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
            <br />
            <strong>Remerge</strong>
            <br />
            Email: testremerge@gmail.com
          </p>
          <p>
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