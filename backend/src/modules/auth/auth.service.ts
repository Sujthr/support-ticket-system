import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { SignupDto, LoginDto, InviteUserDto } from './dto/auth.dto';
import { JwtPayload, AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const slug = dto.organizationSlug || dto.organizationName.toLowerCase().replace(/\s+/g, '-');

    // Check if org slug already exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug },
    });
    if (existingOrg) {
      throw new ConflictException('Organization slug already taken');
    }

    // Create org + admin user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.organizationName,
          slug,
        },
      });

      const passwordHash = await bcrypt.hash(dto.password, 12);

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'ADMIN',
          organizationId: org.id,
        },
      });

      // Create default SLA policies for the org
      await tx.slaPolicy.createMany({
        data: [
          { name: 'Urgent SLA', priority: 'URGENT', firstResponseMinutes: 30, resolutionMinutes: 240, organizationId: org.id },
          { name: 'High SLA', priority: 'HIGH', firstResponseMinutes: 60, resolutionMinutes: 480, organizationId: org.id },
          { name: 'Medium SLA', priority: 'MEDIUM', firstResponseMinutes: 240, resolutionMinutes: 1440, organizationId: org.id },
          { name: 'Low SLA', priority: 'LOW', firstResponseMinutes: 480, resolutionMinutes: 2880, organizationId: org.id },
        ],
      });

      return { user, org };
    });

    const tokens = await this.generateTokens(result.user);

    return {
      user: this.sanitizeUser(result.user),
      organization: result.org,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const org = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email_organizationId: {
          email: dto.email,
          organizationId: org.id,
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      organization: org,
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Delete old token
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokens(stored.user);
    return tokens;
  }

  async inviteUser(dto: InviteUserDto, currentUser: AuthenticatedUser) {
    const existing = await this.prisma.user.findUnique({
      where: {
        email_organizationId: {
          email: dto.email,
          organizationId: currentUser.organizationId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('User already exists in this organization');
    }

    // Generate a temporary password (in production, send an invite email)
    const tempPassword = uuidv4().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role as any,
        organizationId: currentUser.organizationId,
      },
    });

    return {
      user: this.sanitizeUser(user),
      temporaryPassword: tempPassword,
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  private async generateTokens(user: any) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
