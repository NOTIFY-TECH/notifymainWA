import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Request, Response } from 'express';
import { SignupDto } from './dto/signup.dto';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('tenants/:tenantId/register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(tenantId, dto);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Post('tenants/:tenantId/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Param('tenantId') tenantId: string,
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      tenantId,
      dto,
      req.headers['user-agent'],
      req.ip,
    );
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { userId: string; tenantId: string }) {
    return this.authService.me(user.userId, user.tenantId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token: string =
      req.cookies?.refresh_token ?? (req.body as RefreshTokenDto)?.refreshToken;

    if (!token) {
      throw new (await import('@nestjs/common')).UnauthorizedException(
        'No refresh token',
      );
    }

    const result = await this.authService.refresh(token);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: string =
      req.cookies?.refresh_token ?? (req.body as RefreshTokenDto)?.refreshToken;

    if (token) {
      await this.authService.logout(token);
    }

    res.clearCookie('refresh_token', { path: '/' });
    return { success: true };
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signup(dto);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async globalLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.globalLogin(
      dto,
      req.headers['user-agent'],
      req.ip,
    );
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_TTL_MS,
      path: '/',
    });
  }
}
