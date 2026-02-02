import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

export default function TermsOfServicePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/login')} 
          className="mb-6"
          data-testid="button-back-to-login"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Login
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl" data-testid="text-tos-title">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last Updated: February 2, 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using VisioSquad ("the Platform", "we", "our", or "us"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Platform. These Terms apply to all users of the Platform, including club administrators, directors, coaches, parents, and athletes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                VisioSquad is a multi-tenant software-as-a-service (SaaS) platform designed for sports club management. The Platform provides tools for team management, scheduling, payment processing, athlete registrations, communication, and related administrative functions. We act solely as a technology provider and facilitator, providing the software tools that enable sports organizations to manage their operations.
              </p>
            </section>

            <section className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <h2 className="text-xl font-semibold mb-3">3. Important Disclaimers</h2>
              
              <h3 className="text-lg font-medium mb-2">3.1 Technology Provider Only</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong>VisioSquad acts solely as a technology provider and facilitator.</strong> We provide the software platform that enables sports clubs and organizations to manage their operations, process payments, and communicate with members. We do not operate, manage, or control any sports club, team, or athletic program that uses our Platform.
              </p>

              <h3 className="text-lg font-medium mb-2">3.2 Not a Party to Contracts</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong>VisioSquad is not a party to any contracts, agreements, or arrangements entered into between clubs and their members, parents, athletes, or coaches.</strong> Any contracts, waivers, or agreements created, signed, or managed through our Platform are solely between the club/organization and the individual parties involved. We have no obligations or liabilities arising from such contracts.
              </p>

              <h3 className="text-lg font-medium mb-2">3.3 No Legal Advice</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong>VisioSquad does not provide legal advice.</strong> Any templates, sample documents, waivers, or contract forms provided through our Platform are for informational and convenience purposes only. They should not be construed as legal advice. We strongly recommend that clubs and organizations consult with qualified legal professionals to ensure their documents meet all applicable legal requirements in their jurisdiction.
              </p>

              <h3 className="text-lg font-medium mb-2">3.4 No Verification of Contract Enforceability</h3>
              <p className="text-muted-foreground leading-relaxed">
                <strong>VisioSquad does not verify, validate, or guarantee the enforceability of any contracts, waivers, or agreements created or managed through our Platform.</strong> It is the sole responsibility of the club/organization and its legal counsel to ensure that all contracts and legal documents comply with applicable laws and are legally enforceable in their jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. User Accounts and Responsibilities</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Provide accurate and complete registration information</li>
                <li>Keep your account credentials secure and confidential</li>
                <li>Notify us immediately of any unauthorized access to your account</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Club Administrator Responsibilities</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Club administrators and directors who create or manage clubs on our Platform are solely responsible for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>The content, accuracy, and legal compliance of all waivers, contracts, and documents</li>
                <li>Ensuring proper consent and authorization from parents/guardians for minors</li>
                <li>Compliance with all applicable laws, including child protection and data privacy regulations</li>
                <li>Proper management of their organization's finances and payment collections</li>
                <li>Maintaining appropriate insurance and safety protocols</li>
                <li>All communications sent through the Platform to their members</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Payment Processing</h2>
              <p className="text-muted-foreground leading-relaxed">
                Payment processing services are provided through third-party payment processors. VisioSquad facilitates payment transactions but does not directly process, hold, or have access to your payment card information. All payment transactions are subject to the terms and conditions of the applicable payment processor. We are not responsible for any errors, delays, or issues arising from payment processing.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Privacy and Data Protection</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your use of the Platform is also governed by our Privacy Policy. By using the Platform, you consent to the collection, use, and sharing of your information as described in our Privacy Policy. We implement reasonable security measures to protect user data, but we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                The Platform, including its design, features, functionality, and content, is owned by VisioSquad and is protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the Platform without our prior written consent.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, VISIOSQUAD SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM: (A) YOUR USE OR INABILITY TO USE THE PLATFORM; (B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE PLATFORM; (C) ANY CONTENT OBTAINED FROM THE PLATFORM; OR (D) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify, defend, and hold harmless VisioSquad and its officers, directors, employees, agents, and affiliates from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to your use of the Platform, your violation of these Terms, or your violation of any rights of another party.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Modifications to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of material changes by posting the updated Terms on the Platform and updating the "Last Updated" date. Your continued use of the Platform after such changes constitutes your acceptance of the modified Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your access to the Platform at any time, with or without cause or notice. Upon termination, your right to use the Platform will immediately cease. All provisions of these Terms that by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnification, and limitations of liability.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which VisioSquad operates, without regard to its conflict of law provisions. Any disputes arising from these Terms or your use of the Platform shall be resolved through binding arbitration in accordance with applicable arbitration rules.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">14. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us through the Platform's support channels.
              </p>
            </section>

            <section className="pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center">
                By using VisioSquad, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </section>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
